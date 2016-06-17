import {promisify} from '../promise';
import {expect} from 'chai';

describe('promise', function() {
    describe('promisify', function() {
        it('converts function successfully', function() {
            let functionWithCallback = (cb) => {
                cb(42);
            };

            let resultPromise = promisify(functionWithCallback, this);
            return resultPromise.then(result => {
                expect(result).to.equal(42);
            });
        });

        it('sets this argument correctly', function() {
            let functionWithCallback = function(cb) {
                expect(this.k).to.equal('zardoz');
                cb(42);
            };

            let thisObj = {k: 'zardoz'};
            return promisify(functionWithCallback, thisObj);
        });
    });
});