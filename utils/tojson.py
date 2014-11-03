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
import pprint

print 'CoursePad.me Roster Database Generator'

base_dir = os.path.join(sys.argv[1])
term = sys.argv[2].strip()
current_sn = int(sys.argv[3])

# subjectlist

all_subjects_xml = et.parse(os.path.join(base_dir, "raw_roster", term+'_'+str(current_sn), "subjects.xml"))
subjects = []
for node in all_subjects_xml.getroot():
    subjects.append({
        'sub' : node.get('subject'),
        'desc' : node.get('subject_ldescr')
    })

subjects.sort(key=lambda x: x['sub'])

previous_maxid = 0

course_id = 9719

previous_db = simplejson.load(open(os.path.join(base_dir, 'roster', term + '_' + str(current_sn - 1), 'term_db_' + term + '.json')))

print 'Previous Database Loaded. There are %d courses in total' % len(previous_db['roster'])
print 'Building Index on Previous DB'

previous_course_by_id = {}

previous_course_by_number = defaultdict(list)
for course in previous_db['roster']:
    previous_course_by_number[course['sub']+str(course['nbr'])].append(course)
    previous_course_by_id[course['id']] = course
    previous_maxid = max(previous_maxid, course['id'])

previous_subjects = previous_db['subjects']

matched_courses = set()

# crawl roster
load_datetime = set()

fns = glob.glob(os.path.join(base_dir, "raw_roster", term + '_' + str(current_sn), 'subjects', '*.xml'))
xmls = [et.parse(fn) for fn in fns]

all_profs = set()

faulty_prof = {
    'Francis,J)' : 'Francis,J (jdf2)',
    'Glathar,E)' : 'Glathar,E',
    'Cady,B)' : 'Cady,B'
}

section_types = set()

day_pattern = {
    'M': 1,
    'T': 1<<1,
    'W': 1<<2,
    'R': 1<<3,
    'F': 1<<4,
    'S': 1<<5,
    'U': 1<<6
}

def dict_similarity(dict_a, dict_b):
    if isinstance(dict_a, dict) and isinstance(dict_b, dict):
        keys_a = set(dict_a.iterkeys())
        keys_b = set(dict_b.iterkeys())
        single = 1 / len(keys_a | keys_b)
        return single * sum(dict_similarity(dict_a[k], dict_b[k]) for k in (keys_a & keys_b))
    elif isinstance(dict_a, list) and isinstance(dict_b, list):
        return 1/max(len(dict_a), len(dict_b)) * sum(dict_similarity(dict_a[i], dict_b[i]) for i in xrange(min(len(dict_a), len(dict_b))))
    else:
        return 1 if dict_a == dict_b else 0

def to_bool(s):
    return True if s == 'Y' else False

def to_list(node):
    return [a.text.strip() for a in node]


def set_if_truthy(obj, idx, value):
    if value:
        obj[idx] = value

def convert_crosslist(c):
    if c is None:
        return None
    if len(c) > 0:
        return [c.find('subject').text, int(c.find('catalog_nbr').text)]
    return None

def get_s(node):
    if node is None:
        return None
    return node.text

def parse_prof(name):
    if name in faulty_prof:
        name = faulty_prof[name]

    result = re.search(r'\((.+)\)', name)
    if result is None:
        print "warning: %s dont have netid" % name
        return name
    else:
        netid = result.group(1)
        all_profs.add(netid)
        return netid


def convert_meeting(node):
    obj = {}
    pattern = 0
    pattern_desc = node.find('meeting_pattern_sdescr').text
    if pattern_desc != 'TBA':
        for c in pattern_desc:
            pattern |= day_pattern[c]
    set_if_truthy(obj, 'ptn', pattern)
    set_if_truthy(obj, 'bldg', node.find('building_code').text)
    set_if_truthy(obj, 'rm', node.find('room').text)
    set_if_truthy(obj, 'st', node.find('start_time').text)
    set_if_truthy(obj, 'et', node.find('end_time').text)
    set_if_truthy(obj, 'sd', node.find('start_date').text)
    set_if_truthy(obj, 'ed', node.find('end_date').text)
    set_if_truthy(obj, 'profs', [parse_prof(s) for s in to_list(node.find('instructors') or [])])

    return obj


def convert_section(node):
    comp = node.get('ssr_component')

    obj = {}
    obj['nbr'] = int(node.get('class_number'))
    obj['sec'] = node.get('class_section')
    section_types.add(comp)
    set_if_truthy(obj, 'consent', get_s(node.find('consent_ldescr')))
    set_if_truthy(obj, 'note', get_s(node.find('notes')))
    set_if_truthy(obj, 'mt', [convert_meeting(s) for s in node.findall('meeting')])

    return comp, obj

def maybe_float(s):
    if s.find('.') > -1:
        return float(s)
    return int(s)

def convert_units(s):
    return [maybe_float(a) for a in s.split('-')]

added_courses = []

def all_section_numbers_set(course):
    return reduce(lambda acc, sec: acc | set(a['nbr'] for a in sec), course['secs'].values(), set())

def find_id_for_course(course):
    previous_courses = previous_course_by_number[course['sub'] + str(course['nbr'])]
    if len(previous_courses) == 0:
        return 0
    if len(previous_courses) == 1:
        return previous_courses[0]['id']

    # which is the best???
    cn1 = all_section_numbers_set(course)
    def sim_with_course(c2):
        return dict_similarity(c2, course)

    best_course = max(previous_courses, key=sim_with_course)
    if best_course['id'] in matched_courses:
        print 'the best course is selected before, weird!!'
        print 'Best Course'
        print best_course
        print 'All Previous Courses'
        print previous_courses
        print 'This Course'
        print course
        print dict_similarity(best_course, course)
        print 'Previous Match'
        for course in courses:
            if course['id'] == best_course['id']:
                print course
                del course['id']
                print dict_similarity(course, best_course)
                break

        sys.exit(0)

    return best_course['id']


def convert_course(node):
    global course_id
    course_id += 1
    obj = {}

    obj['sub'] = node.get('subject')
    obj['nbr'] = int(node.get('catalog_nbr'))
    obj['unit'] = convert_units(node.find('units').text)
    obj['title'] = node.find('course_title').text
    set_if_truthy(obj, 'topics', to_list(node.find('topics')))
    set_if_truthy(obj, 'crosslists', [convert_crosslist(a) for a in node.find('crosslists') or []])
    set_if_truthy(obj, 'comeetings', [convert_crosslist(a) for a in node.find('comeetings') or []])
    secs = {}
    for sec in node.find('sections'):
        comp, sec = convert_section(sec)
        if comp not in secs:
            secs[comp] = []
        secs[comp].append(sec)

    obj['secs'] = secs

    return obj


courses = []

course_by_number = defaultdict(list)

for xml in xmls:
    load_datetime.add(xml.getroot().get('datetime_load'))
    for c in xml.getroot():
        courses.append(convert_course(c))

for course in courses:
    course_by_number[course['sub'] + str(course['nbr'])].append(course)

total = 0

def genmatching(shortlist, longlist):
    return [max(xrange(len(longlist)), key=lambda i: dict_similarity(d, longlist[i])) for d in shortlist]

def pprintcslist(ls):
    result = [a.copy() for a in ls]
    for i in xrange(len(result)):
        result[i]['index'] = i
        if 'id' in result[i]:
            del result[i]['id']
    pprint.pprint(result)


for key, courseswithno in course_by_number.iteritems():
    prevwithno = previous_course_by_number[key]
    if key not in previous_course_by_number:
        added_courses.extend(courseswithno)
    elif len(courseswithno) == len(previous_course_by_number[key]) == 1:
        courseswithno[0]['id'] = previous_course_by_number[key][0]['id']
        matched_courses.add(previous_course_by_number[key][0]['id'])
    else:
        allsame = len(courseswithno) == len(previous_course_by_number[key])
        if allsame:
            for i in xrange(len(courseswithno)):
                p = previous_course_by_number[key][i].copy()
                del p['id']
                c = courseswithno[i]
                if dict_similarity(p, c) < 1:
                    allsame = False
                    break
        if allsame:
            for i in xrange(len(courseswithno)):
                courseswithno[i]['id'] = prevwithno[i]['id']
                matched_courses.add(courseswithno[i]['id'])
        else:

            # if len(courseswithno) == len(prevwithno):
            #     matching = genmatching(courseswithno, prevwithno)
            #     if len(matching) != len(set(matching)):
            #         # duplicates
            #         pprint.pprint(previous_course_by_number[key])
            #         print '=========================================='
            #         pprint.pprint(courseswithno)
            #         while True:
            #             matching = input('Please manually resolve matching: ')
            #             if len(matching) == len(courseswithno):
            #                 break
            #             print 'Length not right'

            #     for i in xrange(len(matching)):
            #         courseswithno[matching[i]]['id'] = prevwithno[i]['id']
            #         matched_courses.add(prevwithno[i]['id'])

            # else:
            # total += 1
            shortlist, longlist = (courseswithno, prevwithno) if len(courseswithno) <= len(prevwithno) else (prevwithno, courseswithno)
            matching = genmatching(shortlist, longlist)
            if len(matching) != len(set(matching)):
                print matching

                pprintcslist(shortlist)
                print '=========================================='
                pprintcslist(longlist)
                
                while True:
                    matching = input('Please manually resolve matching: ')
                    if len(matching) != len(shortlist):
                        print 'Length not right'
                        continue

                    for i in matching:
                        if i >= len(longlist):
                            print '%d is out of range' % i
                            continue
                    break

            for i in xrange(len(matching)):
                if matching[i] >= 0:
                    if 'id' in shortlist[i]:
                        longlist[matching[i]]['id'] = shortlist[i]['id']
                        matched_courses.add(shortlist[i]['id'])
                    else:
                        shortlist[i]['id'] = longlist[matching[i]]['id']
                        matched_courses.add(shortlist[i]['id'])

            for course in courseswithno:
                if 'id' not in course:
                    added_courses.append(course)


for course in added_courses:
    previous_maxid += 1
    course['id'] = previous_maxid

courses.sort(key=lambda x: x['id'])

print 'Done.'
print 'Added these courses'
for course in added_courses:
    print "%s %d: %s" % (course['sub'], course['nbr'], course['title'])

deleted = []

for course in previous_db['roster']:
    if course['id'] not in matched_courses:
        deleted.append(course['id'])

print 'Deleted these courses'
print deleted

modified = []

for course in courses:
    if course['id'] in previous_course_by_id and dict_similarity(previous_course_by_id[course['id']], course) < 1:
        modified.append(course)

print 'Modified %d courses' % len(modified)


assert len(load_datetime) == 1

roster_time = timezone('US/Eastern').localize(datetime.datetime.strptime(list(load_datetime)[0], '%Y-%m-%d %H:%M:%S'))
roster_unixtime = int(roster_time.strftime("%s"))

# crawl profs

profs = []

"""

prof_vcards = glob.glob('profs/*.vcard')
for vcard in prof_vcards:
    bn = os.path.basename(vcard)
    netid = bn[:bn.find('.')]
    obj = {'netid': netid}
    vf = open(vcard, "r")
    for line in vf:
        if line.startswith("N:"):
            names = line[2:].strip().split(";")
            obj['names'] = names
        if line.startswith("TITLE:"):
            title = line[len("TITLE:"):].strip()
            set_if_truthy(obj, 'title', title)
    profs.append(obj)
"""


meta = {'global_db_time': int(time.time()),
        'roster_time': {'sp15' : roster_unixtime}}

def conv_sub(ls):
    m = {}
    for d in ls:
        m[d['sub']] = d
    return m

previous_subjects_by_key = conv_sub(previous_subjects)
subjects_by_key = conv_sub(subjects)

sub_added = []
sub_deleted = []
sub_modified = []

for key, value in subjects_by_key.iteritems():
    if key not in previous_subjects_by_key:
        sub_added.append(value)
    elif previous_subjects_by_key[key] != subjects_by_key[key]:
        sub_modified.append(value)

for key in previous_subjects_by_key.iterkeys():
    if key not in subjects_by_key:
        sub_deleted.append(key)


global_db = {
    'professors' : profs,
}

term_db = {
    'subjects' : subjects,
    'roster' : courses,
    'time' : roster_unixtime
}

diff_db = {
    'roster' : {
        'modified' : modified,
        'added' : added_courses,
        'deleted' : deleted
    },
    'subjects' : {
        'added' : sub_added,
        'modified' : sub_modified,
        'deleted' : sub_deleted
    },
    'time' : roster_unixtime,
    'prev_time' : previous_db['time']
}

def wr(var, n):
    root_dir = os.path.join(base_dir, 'roster', term + '_' + str(current_sn))
    if not os.path.exists(root_dir):
        os.makedirs(root_dir)
    output = open(os.path.join(root_dir, n + '.json'), 'wb')
    simplejson.dump(var, output)
    output.close()

    output = open(os.path.join(root_dir, n + '_readable.json'), 'wb')
    simplejson.dump(var, output, indent='  ', sort_keys=True)
    output.close()


wr(global_db, 'global_db')
wr(term_db, 'term_db_sp15')
wr(meta, 'meta')

wr(diff_db, 'diff')