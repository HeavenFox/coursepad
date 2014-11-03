import simplejson
import sys

orig = simplejson.load(open(sys.argv[1], 'r'))
diff = simplejson.load(open(sys.argv[2], 'r'))

roster_by_id = {}
for course in orig['roster']:
    roster_by_id[course['id']] = course

for c in diff['roster']['modified']:
    roster_by_id[c['id']] = c

for c in diff['roster']['deleted']:
    del roster_by_id[c]

for c in diff['roster']['added']:
    roster_by_id[c['id']] = c



new_roster = roster_by_id.values()
new_roster.sort(key=lambda x: x['id'])

orig['roster'] = new_roster

subject_by_sub = {}
for subject in orig['subjects']:
    subject_by_sub[subject['sub']] = subject


for s in diff['subjects']['modified']:
    subject_by_sub[s['sub']] = s


for s in diff['subjects']['deleted']:
    del subject_by_sub[s]

for s in diff['subjects']['added']:
    subject_by_sub[s['sub']] = s

new_subjects = subject_by_sub.values()
new_subjects.sort(key=lambda x: x['sub'])

orig['subjects'] = new_subjects
orig['time'] = diff['time']

simplejson.dump(orig, sys.stdout, indent='  ', sort_keys=True)