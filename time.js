

export default class Time {
	constructor (hour, minute) {
		if (hour.constructor.name == 'Time') {
			this.hour = hour.hour;
			this.minute = hour.minute;
		} else {
			this.hour = hour;
			this.minute = minute;
		}
	}

	isBefore(time) {
		if (this.hour < time.hour) {
			return true;
		} else if (this.hour == time.hour) {
			if (this.minute < time.minute) {
				return true;
			}
		}
		return false;
	}

	isSame(time) {
		return this.hour == time.hour && this.minute == time.minute;
	}

	static fromString(string) {
		let [hour, minute] = string.split(":");
		hour = parseInt(hour);
		minute = parseInt(minute || 0);
		if (hour < 0 || hour > 23) {
			throw "Invalid hour";
		}
		if (minute < 0 || minute > 59) {
			throw "Invalid minute";
		}
		return new Time(hour, minute);
	}

	toDate() {
		let date = new Date();
		date.setHours(this.hour);
		date.setMinutes(this.minute);
		return date;
	}

	toString() {
		let minute = this.minute.toString();
		if (minute.length == 1) {
			minute = "0" + minute;
		}
		return `${this.hour}:${minute}`;
	}

	toJSON() {
		return [
			this.hour,
			this.minute
		]
	}
}