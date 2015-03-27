from __future__ import division

import simplejson
import argparse
import sys
import glob
import xml.etree.ElementTree as et
import re
import os
import time
import datetime
import copy
from pytz import timezone
from collections import defaultdict

from lib.course import CourseParser
from lib.course_match import CourseMatcher
from lib.subject_match import SubjectMatcher

print 'CoursePad.me Roster Database Generator'

base_dir = os.path.join(sys.argv[1])
term = sys.argv[2].strip()
current_sn = int(sys.argv[3])

# subjectlist
fns = glob.glob(os.path.join(base_dir, "raw_roster", term + '_' + str(current_sn), 'subjects', '*.xml'))
xmls = [et.parse(fn) for fn in fns]

all_subjects_xml = et.parse(os.path.join(base_dir, "raw_roster", term+'_'+str(current_sn), "subjects.xml"))
subjects = []
for node in all_subjects_xml.getroot():
    subjects.append({
        'sub' : node.get('subject'),
        'desc' : node.get('subject_ldescr')
    })

subjects.sort(key=lambda x: x['sub'])

# Read Previous Course ID
course_id_path = os.path.join(base_dir, 'track', 'course_id')
previous_maxid = int(open(course_id_path, 'r').read())
open(course_id_path + '.bak', 'w').write(str(previous_maxid))

# Read Previous DB
isbrandnew = False
if current_sn > 1:
    previous_db = simplejson.load(open(os.path.join(base_dir, 'roster', term + '_' + str(current_sn - 1), 'term_db_' + term + '.json')))

    print 'Previous Database Loaded. There are %d courses in total' % len(previous_db['roster'])
    print 'Building Index on Previous DB'


    previous_course_by_number = defaultdict(list)
    for course in previous_db['roster']:
        previous_course_by_number[course['sub']+str(course['nbr'])].append(course)

    previous_subjects = previous_db['subjects']

else:
    isbrandnew = True



# -------------------------------------
# Parse Courses
# -------------------------------------

course_parser = CourseParser()

load_datetime = set()

for xml in xmls:
    load_datetime.add(xml.getroot().get('datetime_load'))
    for c in xml.getroot():
        course_parser.parse(c)

assert len(load_datetime) == 1
roster_time = timezone('US/Eastern').localize(datetime.datetime.strptime(list(load_datetime)[0], '%Y-%m-%d %H:%M:%S'))
roster_unixtime = int(roster_time.strftime("%s"))


courses = course_parser.courses

course_by_number = defaultdict(list)
for course in courses:
    course_by_number[course['sub'] + str(course['nbr'])].append(course)


# -------------------------------------
# Match Courses
# -------------------------------------
if isbrandnew:
    for course in courses:
        previous_maxid += 1
        course['id'] = previous_maxid

else:
    course_matcher = CourseMatcher()

    course_matcher.previous_maxid = previous_maxid

    course_matcher.match(previous_course_by_number, course_by_number)

    print 'Done.'
    print 'Added these courses'
    for course in course_matcher.added:
        print "%s %d: %s" % (course['sub'], course['nbr'], course['title'])

    print 'Deleted these courses'
    print course_matcher.deleted

    print 'Modified %d courses' % len(course_matcher.modified)

    previous_maxid = course_matcher.previous_maxid

    courses.sort(key=lambda x: x['id'])

with open(course_id_path, 'w') as f:
    f.write(str(previous_maxid))

# -------------------------------------
# Match Subjects
# -------------------------------------
if not isbrandnew:
    subject_matcher = SubjectMatcher()
    subject_matcher.match(previous_subjects, subjects)


def persist_file(fn):
    return os.path.join(base_dir, 'persist', fn)

persist_dir = os.path.join(base_dir, 'persist')

with open(persist_file('meta.json'), 'r') as f:
    meta = simplejson.load(f)

meta['generated_at'] = int(time.time())
meta['roster_time'][term] = roster_unixtime

with open(persist_file('version_history.json'), 'r') as f:
    version_history = simplejson.load(f)

if term not in version_history['term_db']:
    version_history['term_db'][term] = []

version_history['term_db'][term].append(roster_unixtime)


term_db = {
    'subjects' : subjects,
    'roster' : courses,
    'time' : roster_unixtime
}

if not isbrandnew:
    diff_db = {
        'roster' : {
            'modified' : course_matcher.modified,
            'added' : course_matcher.added,
            'deleted' : course_matcher.deleted
        },
        'subjects' : {
            'added' : subject_matcher.added,
            'modified' : subject_matcher.modified,
            'deleted' : subject_matcher.deleted
        },
        'time' : roster_unixtime,
        'prev_time' : previous_db['time']
    }

def wr(var, n, root_dir=None, sub_dir=None):
    if root_dir is None:
        root_dir = os.path.join(base_dir, 'roster', term + '_' + str(current_sn))
        if sub_dir is not None:
            root_dir = os.path.join(root_dir, sub_dir)

    if not os.path.exists(root_dir):
        os.makedirs(root_dir)
    output = open(os.path.join(root_dir, n + '.json'), 'wb')
    simplejson.dump(var, output)
    output.close()

    output = open(os.path.join(root_dir, n + '_readable.json'), 'wb')
    simplejson.dump(var, output, indent='  ', sort_keys=True)
    output.close()


wr(term_db, 'term_db_' + term)
wr(meta, 'meta', persist_dir)
wr(version_history, 'version_history', root_dir=persist_dir)
if not isbrandnew:
    wr(diff_db, 'diff_termdb_' + term + '_' + str(previous_db['time']) + '_' + str(roster_unixtime), sub_dir='diffs')