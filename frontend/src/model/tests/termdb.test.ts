import "fake-indexeddb/auto";

import { TermDatabase, LocalTermDatabase } from "../termdb";
import * as indexeddb from "../../persist/indexeddb";

/* tslint:disable:trailing-comma */
const testData = {
  subjects: [
    {
      sub: "PMA",
      desc: "Performing and Media Arts"
    },
    {
      sub: "SPAN",
      desc: "Spanish"
    },
    {
      sub: "PSYCH",
      desc: "Psychology"
    }
  ],
  time: 0,
  roster: [
    {
      sub: "SPAN",
      title: "Spanish 101",
      nbr: 1101,
      secs: {
        SEM: [
          {
            nbr: 3853,
            sec: "101",
            mt: []
          }
        ]
      },
      session: "1",
      id: 1,
      unit: [4]
    },
    {
      sub: "PMA",
      title: "Introduction to Film",
      nbr: 1120,
      secs: {
        STU: [
          {
            nbr: 18157,
            sec: "501",
            mt: []
          }
        ]
      },
      session: "1",
      id: 2,
      unit: [4]
    },
    {
      sub: "PSYCH",
      title: "Social Psychology",
      nbr: 2210,
      secs: {
        LEC: [
          {
            nbr: 5938,
            sec: "001",
            mt: [
              {
                ed: "05/11/2016",
                sd: "01/27/2016"
              }
            ]
          }
        ]
      },
      session: "1",
      id: 3,
      unit: [4]
    }
  ]
};

let modifiedSubject = {
  sub: "PMA",
  desc: "Performing & Media Arts"
};
let addedSubject = {
  sub: "LAW",
  desc: "Law"
};
let addedCourse = {
  sub: "PMA",
  title: "Interpretive Dance",
  nbr: 4120,
  secs: {
    LEC: [
      {
        nbr: 1292,
        sec: "001",
        mt: [
          {
            ed: "05/11/2016",
            sd: "01/27/2016"
          }
        ]
      }
    ]
  },
  session: "1",
  id: 4,
  unit: [4]
};

let modifiedCourse = {
  sub: "PSYCH",
  title: "Social Psychology II",
  nbr: 2530,
  secs: {
    LEC: [
      {
        nbr: 4421,
        sec: "001",
        mt: [
          {
            ed: "05/11/2016",
            sd: "01/27/2016"
          }
        ]
      }
    ]
  },
  session: "1",
  id: 3,
  unit: [4]
};

let modifiedCourse2 = {
  sub: "PSYCH",
  title: "Social Psychology III",
  nbr: 3120,
  secs: {
    LEC: [
      {
        nbr: 4324,
        sec: "001",
        mt: [
          {
            ed: "05/11/2016",
            sd: "01/27/2016"
          }
        ]
      }
    ]
  },
  session: "1",
  id: 3,
  unit: [4]
};

const testTerm = "fa09";

describe("LocalTermDatabase", function() {
  beforeEach(function() {
    indexeddb.setDatabase("coursepad_test");
  });

  afterEach(function() {
    return indexeddb.close();
  });

  describe("checkIntegrity", function() {
    let addSubject = async function() {
      await indexeddb.add("subjects", {
        term: testTerm,
        sub: "PMA",
        desc: "Performing & Media Arts"
      });
    };

    let addRoster = async function() {
      await indexeddb.add("roster", {
        term: testTerm,
        sub: "PSYCH",
        title: "Social Psychology II",
        nbr: 2530,
        secs: {
          LEC: [
            {
              nbr: 4421,
              sec: "001",
              mt: [
                {
                  ed: "05/11/2016",
                  sd: "01/27/2016"
                }
              ]
            }
          ]
        },
        session: "1",
        id: 3,
        unit: [4]
      });
    };

    let addIndex = async function() {
      await indexeddb.add("title_typeahead_index", {
        term: testTerm,
        index: []
      });
    };

    afterEach(function() {
      return LocalTermDatabase.deleteTerm(testTerm);
    });

    it("should reject term without subjects", async function() {
      let db = new LocalTermDatabase(testTerm);
      await addIndex();
      await addRoster();
      expect(await db.checkIntegrity()).toBeFalsy();
    });

    it("should reject term without roster", async function() {
      let db = new LocalTermDatabase(testTerm);
      await addIndex();
      await addSubject();
      expect(await db.checkIntegrity()).toBeFalsy();
    });

    it("should reject term without index", async function() {
      let db = new LocalTermDatabase(testTerm);
      await addSubject();
      await addRoster();
      expect(await db.checkIntegrity()).toBeFalsy();
    });

    it("should accept seemingly valid term db", async function() {
      let db = new LocalTermDatabase(testTerm);
      await addSubject();
      await addRoster();
      await addIndex();
      expect(await db.checkIntegrity()).toBeTruthy();
    });
  });

  describe("applyUpdates", function() {
    beforeEach(function() {
      return LocalTermDatabase.loadTerm(testTerm, testData);
    });

    afterEach(function() {
      return LocalTermDatabase.deleteTerm(testTerm);
    });

    it("should be able to update courses", async function() {
      let db = new LocalTermDatabase(testTerm);

      let diff = {
        prev_time: 0,
        time: 1,
        roster: {
          deleted: [1, 2],
          added: [addedCourse],
          modified: [modifiedCourse]
        }
      };

      await db.applyUpdates([diff]);

      let expectedCourses = [modifiedCourse, addedCourse];
      let observedCourses = await indexeddb.queryAllByIndex(
        "roster",
        "term",
        IDBKeyRange.only(testTerm)
      );

      expect(observedCourses).toEqual(expectedCourses);

      let comparator = (a, b) => a["title"].localeCompare(b["title"]);
      let storedIndex = await indexeddb.getByKey(
        "title_typeahead_index",
        testTerm
      );
      let observedIndex = storedIndex["index"].sort(comparator);
      let expectedIndex = expectedCourses
        .map(course => {
          return {
            course: [course["sub"], course["nbr"]],
            title: course["sub"] + course["nbr"] + ": " + course["title"]
          };
        })
        .sort(comparator);

      expect(observedIndex).toEqual(expectedIndex);
    });

    it("should be able to update subjects", async function() {
      let db = new LocalTermDatabase(testTerm);

      let diff = {
        prev_time: 0,
        time: 1,
        subjects: {
          deleted: ["SPAN"],
          added: [addedSubject],
          modified: [modifiedSubject]
        }
      };

      await db.applyUpdates([diff]);

      let expected = [modifiedSubject, testData.subjects[2], addedSubject];
      let observed = await indexeddb.queryAllByIndex(
        "subjects",
        "term",
        IDBKeyRange.only(testTerm)
      );

      expect(observed).toEqual(expected);
    });

    it("should allow chained updates", async function() {
      let db = new LocalTermDatabase(testTerm);
      let diffs = [
        {
          prev_time: 0,
          time: 1,
          roster: {
            deleted: [1],
            added: [addedCourse],
            modified: [modifiedCourse]
          }
        },
        {
          prev_time: 1,
          time: 2,
          roster: {
            deleted: [2],
            added: [],
            modified: [modifiedCourse2]
          },
          subjects: {
            deleted: ["SPAN"],
            added: [addedSubject],
            modified: [modifiedSubject]
          }
        }
      ];

      await db.applyUpdates(diffs);

      let expectedCourses = [modifiedCourse2, addedCourse];
      let observedCourses = await indexeddb.queryAllByIndex(
        "roster",
        "term",
        IDBKeyRange.only(testTerm)
      );

      expect(observedCourses).toEqual(expectedCourses);

      let expectedSubjects = [
        modifiedSubject,
        testData.subjects[2],
        addedSubject
      ];
      let observedSubjects = await indexeddb.queryAllByIndex(
        "subjects",
        "term",
        IDBKeyRange.only(testTerm)
      );

      expect(observedSubjects).toEqual(expectedSubjects);
    });
  });
});
