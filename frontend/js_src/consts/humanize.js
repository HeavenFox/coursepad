var sectionType = {
    "LEC" : "Lecture",
    "SEM" : "Seminar",
    "CLN" : "Clinic",
    "LAB" : "Labs",
    "RSC" : "Research",
    "DIS" : "Discussion"
}



module.exports = {
    getSectionType: function() {

    },

    sortTerms: function(terms, desc) {
        var termOrder = {
            fa: 1,
            sp: 3
        }
        return terms.sort(function(a, b) {
            return (desc ? -1 : 1) * ((+a.slice(2) - b.slice(2)) || (termOrder[a.slice(0, 2)] - termOrder[b.slice(0, 2)]));
        });
    },

    getTermName: function(term) {
        var termName = {
            fa: 'Fall',
            sp: 'Spring'
        };

        function year(digit) {
            if (digit < 50) {
                return 2000 + digit;
            } else {
                return 1900 + digit;
            }
        }

        return termName[term.slice(0, 2)] + ' ' + year(+term.slice(2));
    }
};