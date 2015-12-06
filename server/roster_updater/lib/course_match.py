from __future__ import division

import itertools
import pprint

def dict_similarity(dict_a, dict_b):
    if isinstance(dict_a, dict) and isinstance(dict_b, dict):
        keys_a = set(dict_a.iterkeys())
        keys_b = set(dict_b.iterkeys())
        single = 1 / len(keys_a | keys_b)
        return single * sum(dict_similarity(dict_a[k], dict_b[k]) for k in (keys_a & keys_b))
    elif isinstance(dict_a, list) and isinstance(dict_b, list):
        return 1/max(len(dict_a), len(dict_b)) * sum(dict_similarity(dict_a[i], dict_b[i]) for i in xrange(min(len(dict_a), len(dict_b))))
    else:
        return 1.0 if dict_a == dict_b else 0


def course_sim(a, b):
    section_measure = 0.95 if all_section_numbers_set(a) == all_section_numbers_set(b) else 0
    return max(dict_similarity(a, b), section_measure)

def all_section_numbers_set(course):
    return reduce(lambda acc, sec: acc | set(a['nbr'] for a in sec), course['secs'].values(), set())


def genmatching(shortlist, longlist):
    short_matched = set()
    long_matched = set()
    score = {}
    match = [-1] * len(shortlist)
    for i in xrange(len(shortlist)):
        for j in xrange(len(longlist)):
            score[i, j] = course_sim(shortlist[i], longlist[j])

    score_items = score.items()
    score_items.sort(key=lambda x: -x[1])
    for pair, score in score_items:
        if score < 0.5:
            break

        i, j = pair
        if i not in short_matched and j not in long_matched:
            match[i] = j
            short_matched.add(i)
            long_matched.add(j)

    return match

def pprintcslist(ls):
    result = [a.copy() for a in ls]
    for i in xrange(len(result)):
        result[i]['index'] = i
        if 'id' in result[i]:
            del result[i]['id']
    pprint.pprint(result)



class CourseMatcher(object):
    def __init__(self):
        self.added = []
        self.modified = []
        self.deleted = []
        self.matched_courses = set()
        self.previous_maxid = 0

    def match(self, previous_course_by_number, course_by_number):

        for key, courseswithno in course_by_number.iteritems():
            if key not in previous_course_by_number:
                self.added.extend(courseswithno)
                continue

            prevwithno = previous_course_by_number[key]
            if len(courseswithno) == len(previous_course_by_number[key]) == 1:
                courseswithno[0]['id'] = previous_course_by_number[key][0]['id']
                self.matched_courses.add(previous_course_by_number[key][0]['id'])
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
                        self.matched_courses.add(courseswithno[i]['id'])
                else:
                    shortlist, longlist = (courseswithno, prevwithno) if len(courseswithno) <= len(prevwithno) else (prevwithno, courseswithno)
                    matching = genmatching(shortlist, longlist)
                    # sanity check
                    for i in xrange(len(matching)):
                        if matching[i] >= 0:
                            for j in xrange(i+1, len(matching)):
                                if matching[i] == matching[j]:
                                    raise Exception('Wrong matching')
                    # if len(matching) != len(set(matching)):
                    # if True:
                    #     print matching

                    #     print '=========================================='
                    #     pprintcslist(shortlist)
                    #     print '=========================================='
                    #     pprintcslist(longlist)
                        

                    #     while True:
                    #         t = input('Please manually resolve matching: ')
                    #         if t == 0:
                    #             break
                    #         matching = t
                    #         if len(matching) != len(shortlist):
                    #             print 'Length not right'
                    #             continue

                    #         for i in matching:
                    #             if i >= len(longlist):
                    #                 print '%d is out of range' % i
                    #                 continue
                    #         break

                    for i in xrange(len(matching)):
                        if matching[i] >= 0:
                            if 'id' in shortlist[i]:
                                longlist[matching[i]]['id'] = shortlist[i]['id']
                                self.matched_courses.add(shortlist[i]['id'])
                            else:
                                shortlist[i]['id'] = longlist[matching[i]]['id']
                                self.matched_courses.add(shortlist[i]['id'])

                    for course in courseswithno:
                        if 'id' not in course:
                            self.added.append(course)


        for course in self.added:
            self.previous_maxid += 1
            course['id'] = self.previous_maxid


        previous_course_by_id = {}
        for course in itertools.chain.from_iterable(previous_course_by_number.itervalues()):
            previous_course_by_id[course['id']] = course
            if course['id'] not in self.matched_courses:
                self.deleted.append(course['id'])

        for course in itertools.chain.from_iterable(course_by_number.itervalues()):
            if course['id'] in previous_course_by_id and dict_similarity(previous_course_by_id[course['id']], course) < 1:
                self.modified.append(course)

