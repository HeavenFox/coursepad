import {timeStringToHour, bitmaskToDay} from '../datetime';
import {expect} from 'chai';

describe('datetime', function() {
    describe('timeStringToHour', function() {
        it('converts AM time correctly', function() {
            expect(timeStringToHour('11:30 AM')).to.equal(11.5);
            expect(timeStringToHour('12:30 AM')).to.equal(0.5);
        });

        it('converts PM time correctly', function() {
            expect(timeStringToHour('12:30 PM')).to.equal(12.5);
            expect(timeStringToHour('11:30 PM')).to.equal(23.5);
        });
    });

    describe('bitmaskToDay', function() {
        it('converts days correctly', function() {
            expect(bitmaskToDay(1 + (1 << 3))).to.equal("MR");
        });
    });
});