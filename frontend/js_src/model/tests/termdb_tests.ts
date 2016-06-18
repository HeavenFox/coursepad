import {TermDatabase, LocalTermDatabase} from '../termdb.ts';
import * as indexeddb from '../../persist/indexeddb.ts';
import {expect} from 'chai';

/* tslint:disable:trailing-comma */
const testData = {
	"subjects": [{
		"sub": "PMA",
		"desc": "Performing and Media Arts"
	}, {
		"sub": "SPAN",
		"desc": "Spanish"
	}, {
		"sub": "PSYCH",
		"desc": "Psychology"
	}],
	"time": 0,
	"roster": [
		{
			"sub": "SPAN",
			"title": "Spanish 101",
			"nbr": 1101,
			"secs": {
				"SEM": [{
					"nbr": 3853,
					"sec": "101",
					"mt": []
				}]
			},
			"session": "1",
			"id": 1,
			"unit": [4]
		},
		{
			"sub": "PMA",
			"title": "Introduction to Film",
			"nbr": 1120,
			"secs": {
				"STU": [{
					"nbr": 18157,
					"sec": "501",
					"mt": []
				}]
			},
			"session": "1",
			"id": 2,
			"unit": [4]
		},
		{
			"sub": "PSYCH",
			"title": "Social Psychology",
			"nbr": 2210,
			"secs": {
				"LEC": [{
					"nbr": 5938,
					"sec": "001",
					"mt": [{
						"ed": "05/11/2016",
						"sd": "01/27/2016"
					}]
				}]
			},
			"session": "1",
			"id": 3,
			"unit": [4]
		}
	]
};

let modifiedSubject = {
    "sub": "PMA",
    "desc": "Performing & Media Arts"
};
let addedSubject = {
    "sub": "LAW",
    "desc": "Law"
};
let addedCourse = {
    "sub": "PMA",
    "title": "Interpretive Dance",
    "nbr": 4120,
    "secs": {
        "LEC": [{
            "nbr": 1292,
            "sec": "001",
            "mt": [{
                "ed": "05/11/2016",
                "sd": "01/27/2016"
            }]
        }]
    },
    "session": "1",
    "id": 4,
    "unit": [4]
};

let modifiedCourse = {
    "sub": "PSYCH",
    "title": "Social Psychology II",
    "nbr": 2530,
    "secs": {
        "LEC": [{
            "nbr": 4421,
            "sec": "001",
            "mt": [{
                "ed": "05/11/2016",
                "sd": "01/27/2016"
            }]
        }]
    },
    "session": "1",
    "id": 3,
    "unit": [4]
};

let modifiedCourse2 = {
    "sub": "PSYCH",
    "title": "Social Psychology III",
    "nbr": 3120,
    "secs": {
        "LEC": [{
            "nbr": 4324,
            "sec": "001",
            "mt": [{
                "ed": "05/11/2016",
                "sd": "01/27/2016"
            }]
        }]
    },
    "session": "1",
    "id": 3,
    "unit": [4]
};

var testTerm = 'fa09';

describe('LocalTermDatabase', function() {
    before(function() {
        indexeddb.setDatabase('coursepad_test');
    });

    after(function() {
        return indexeddb.close();
    });


    describe('applyUpdates', function() {
        beforeEach(function() {
            return LocalTermDatabase.loadTerm(testTerm, testData);
        });

        afterEach(function() {
            return LocalTermDatabase.deleteTerm(testTerm);
        });

        it('should be able to update courses', async function() {
            let db = new LocalTermDatabase(testTerm);

            let diff = {
                "prev_time": 0,
                "time": 1,
                "roster": {
                    "deleted": [1, 2],
                    "added": [addedCourse],
                    "modified": [modifiedCourse]
                }
            };

            let updates = {
                term: testTerm,
                diffs: [diff]
            };

            await db.applyUpdates(updates);

            let expectedCourses = [modifiedCourse, addedCourse];
            let observedCourses = await indexeddb.queryAllByIndex('roster', 'term', IDBKeyRange.only(testTerm));

            expect(observedCourses).to.eql(expectedCourses);

            let comparator = (a,b) => a['title'].localeCompare(b['title']);
            let storedIndex = await indexeddb.getByKey('title_typeahead_index', testTerm);
            let observedIndex = storedIndex['index'].sort(comparator);
            let expectedIndex = expectedCourses.map((course) => {
                return {
                    'course': [course['sub'], course['nbr']],
                    'title': course['sub'] + course['nbr'] + ': ' + course['title']
                };
            }).sort(comparator);

            expect(observedIndex).to.eql(expectedIndex);
        });

        it('should be able to update subjects', async function() {
            let db = new LocalTermDatabase(testTerm);

            let diff = {
                "prev_time": 0,
                "time": 1,
                "subjects": {
                    "deleted": ["SPAN"],
                    "added": [addedSubject],
                    "modified": [modifiedSubject]
                }
            };
            let updates = {
                term: testTerm,
                diffs: [diff]
            };

            await db.applyUpdates(updates);

            let expected = [modifiedSubject, testData.subjects[2], addedSubject];
            let observed = await indexeddb.queryAllByIndex('subjects', 'term', IDBKeyRange.only(testTerm));

            expect(observed).to.eql(expected);
        });

        it('should allow chained updates', async function() {
            let db = new LocalTermDatabase(testTerm);
            let diffs = [
                {
                    "prev_time": 0,
                    "time": 1,
                    "roster": {
                        "deleted": [1],
                        "added": [addedCourse],
                        "modified": [modifiedCourse]
                    }
                },
                {
                    "prev_time": 1,
                    "time": 2,
                    "roster": {
                        "deleted": [2],
                        "added": [],
                        "modified": [modifiedCourse2]
                    },
                    "subjects": {
                        "deleted": ["SPAN"],
                        "added": [addedSubject],
                        "modified": [modifiedSubject]
                    }
                }
            ];
            let updates = {
                term: testTerm,
                diffs: diffs
            };

            await db.applyUpdates(updates);


            let expectedCourses = [modifiedCourse2, addedCourse];
            let observedCourses = await indexeddb.queryAllByIndex('roster', 'term', IDBKeyRange.only(testTerm));

            expect(observedCourses).to.eql(expectedCourses);

            let expectedSubjects = [modifiedSubject, testData.subjects[2], addedSubject];
            let observedSubjects = await indexeddb.queryAllByIndex('subjects', 'term', IDBKeyRange.only(testTerm));

            expect(observedSubjects).to.eql(expectedSubjects);
        });
    });
});
