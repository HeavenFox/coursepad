from __future__ import division

import simplejson
import subprocess
import argparse
import sys
import glob
import xml.etree.ElementTree as et
import re
import os
import time
import datetime
import dateutil.parser
import copy
import urllib
import urllib2
import traceback
import shutil
from pytz import timezone
from collections import defaultdict

from lib.course import CourseParserJson
from lib.course_match import CourseMatcher
from lib.subject_match import SubjectMatcher

import config

print 'CoursePad.me Roster Database Generator'
print 'Current time is: %d' % (int(time.time()), )

ROOT = config.ROSTER_DATA_DIR

class UpdateError(Exception):
    pass

class APIError(UpdateError):
    pass


def isotime_to_unix(s):
    return int(time.mktime(dateutil.parser.parse(s).utctimetuple()))


api_call_time = 0
API_CALL_COOLDOWN = 0.8

def make_api_call(endpoint, args=None):
    global api_call_time
    # Rate limiting
    new_time = time.time()
    if new_time - api_call_time < API_CALL_COOLDOWN:
        time.sleep(API_CALL_COOLDOWN - (new_time - api_call_time))
    api_call_time = new_time

    url = 'https://classes.cornell.edu/api/2.0/' + endpoint
    if args is not None:
        url += '?'
        url += urllib.urlencode(args)

    retry = 3
    result = None
    while retry > 0:
        retry -= 1
        try:
            result = simplejson.load(urllib2.urlopen(url))
            break
        except Exception as e:
            print 'Error: %s, retrying...' % e

    if result is None:
        raise APIError('Cannot call API after retrying')

    if result['status'] != 'success':
        raise APIError('Error (%s): %s' % (result['status'], str(result['message'])))
    else:
        return result['data']



def data_index_file(fn, path=None):
    return os.path.join(ROOT if path is None else path, 'data_index', fn)

with open(data_index_file('meta.json'), 'r') as f:
    meta = simplejson.load(f)

with open(data_index_file('version_history.json'), 'r') as f:
    version_history = simplejson.load(f)


def persist_index():
    with open(data_index_file('meta.json'), 'wb') as f:
        simplejson.dump(meta, f)
    with open(data_index_file('version_history.json'), 'wb') as f:
        simplejson.dump(version_history, f)



# Read Previous Course ID
course_id_path = os.path.join(ROOT, 'track', 'course_id')
course_id_max = int(open(course_id_path, 'r').read())

def ensure_dir(path):
    try:
        os.makedirs(path)
    except OSError:
        pass

def backup_data_index():
    rollback_path = os.path.join(config.ROLLBACK_DIR, str(int(time.time())))
    for d in ['data_index', 'track']:
        ensure_dir(os.path.join(rollback_path, d))

    for fn in ['meta.json', 'version_history.json']:
        shutil.copyfile(data_index_file(fn), data_index_file(fn, rollback_path))

    open(os.path.join(rollback_path, 'track', 'course_id'), 'w').write(str(course_id_max))

# def backup():
#     subprocess.call(['tar', '-czf', os.path.join(config.BACKUP_DIR, 'data_' + time.strftime('%Y%m%d%H%M%S') + '.tar.gz'), config.ROSTER_DATA_DIR])



def update_term(term, roster_time):
    global course_id_max

    print 'Reading subject list...'

    raw_data = {}

    # subjectlist
    subjects = []

    raw_data['subjects'] = make_api_call('config/subjects.json', {'roster': term.upper()})
    for node in raw_data['subjects']['subjects']:
        subjects.append({
            'sub' : node.get('value'),
            'desc' : node.get('descrformal')
        })

    subjects.sort(key=lambda x: x['sub'])


    # -------------------------------------
    # Parse Courses
    # -------------------------------------

    course_parser = CourseParserJson()

    for subj in subjects:
        sub = subj['sub']
        print "Getting " + sub
        raw_data[sub] = make_api_call('search/classes.json', {'roster': term.upper(), 'subject': sub})

        for cls in raw_data[sub]['classes']:
            course_parser.parse(cls)


    courses = course_parser.courses

    course_by_number = defaultdict(list)
    for course in courses:
        course_by_number[course['sub'] + str(course['nbr'])].append(course)

    # Read Previous DB
    isbrandnew = False
    previous_maxid = course_id_max

    if term in meta['roster_time']:
        previous_db = simplejson.load(open(os.path.join(ROOT, 'data', 'termdb_%s_%d.json' % (term, meta['roster_time'][term]))))

        print 'Previous Database Loaded. There are %d courses in total' % len(previous_db['roster'])
        print 'Building Index on Previous DB'


        previous_course_by_number = defaultdict(list)
        for course in previous_db['roster']:
            previous_course_by_number[course['sub']+str(course['nbr'])].append(course)


        course_matcher = CourseMatcher()

        course_matcher.previous_maxid = previous_maxid

        course_matcher.match(previous_course_by_number, course_by_number)

        print 'Done.'
        modified = False
        if course_matcher.added:
            modified = True
            print 'Added these courses'
            for course in course_matcher.added:
                print "%s %d: %s" % (course['sub'], course['nbr'], course['title'])

        if course_matcher.deleted:
            modified = True
            print 'Deleted these courses'
            print course_matcher.deleted

        if course_matcher.modified:
            modified = True
            print 'Modified %d courses' % len(course_matcher.modified)

        if not modified:
            print 'Nothing modified. Bailing out.'
            return


        previous_maxid = course_matcher.previous_maxid

        courses.sort(key=lambda x: x['id'])


        previous_subjects = previous_db['subjects']

        subject_matcher = SubjectMatcher()
        subject_matcher.match(previous_subjects, subjects)


    else:
        isbrandnew = True

        for course in courses:
            previous_maxid += 1
            course['id'] = previous_maxid

    term_db = {
        'subjects' : subjects,
        'roster' : courses,
        'time' : roster_time
    }


    simplejson.dump(raw_data, open(os.path.join(config.AUDIT_DIR, 'raw_data', '%s_%d.json' % (term, roster_time)), 'wb'))

    simplejson.dump(term_db, open(os.path.join(ROOT, 'data', 'termdb_%s_%d.json' % (term, roster_time)), 'wb'))

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
            'time' : roster_time,
            'prev_time' : previous_db['time']
        }

        simplejson.dump(diff_db, open(os.path.join(ROOT, 'data', 'diffs', 'diff_termdb_%s_%d_%d.json' % (term, previous_db['time'], roster_time)), 'wb'))


    meta['generated_at'] = int(time.time())
    meta['roster_time'][term] = roster_time

    if term not in version_history['term_db']:
        version_history['term_db'][term] = []

    version_history['term_db'][term].append(roster_time)

    course_id_max = previous_maxid

    persist_index()
    with open(course_id_path, 'w') as f:
        f.write(str(course_id_max))


# Backup first

backup_data_index()

err_occurred = False

# Obtain terms
rosters = make_api_call('config/rosters.json')

for roster in rosters['rosters']:

    slug = roster['slug']
    term = slug.lower()

    if term in config.OMIT_TERM:
        print 'Omitting %s due to config' % (term)
        continue

    roster_time = isotime_to_unix(roster['lastModifiedDttm'])
    if term not in config.FORCE_TERM:
        if roster['archiveMode'] == 'Y':
            print 'Omitting %s: archive mode' % (term)
            continue

        if roster_time <= meta['roster_time'].get(term, 0):
            print 'Omitting %s: not modified' % (term)
            continue

    print 'Updating term %s' % (term)

    try:
        update_term(term, roster_time=roster_time)
    except UpdateError as e:
        err_occurred = True
        print 'Unable to update term %s: %s' % (term, str(e))
    except Exception:
        err_occurred = True
        print 'Error in updating term %s' % term
        traceback.print_exc()

if err_occurred:
    sys.exit(1)
