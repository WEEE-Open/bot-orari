

export default class FancyDate {
	constructor(day, month, year) {
		if (day instanceof Object) {
			month = day.month;
			year = day.year;
			day = day.day;
		} else if (day instanceof Date) {
			month = day.getMonth();
			year = day.getFullYear();
			day = day.getDate();
		}
		let now = new Date();
		if (day === undefined) day = now.getDate();
		if (month === undefined) month = now.getMonth();
		if (year === undefined) year = now.getFullYear();
		this.day = Number(day);
		this.month = Number(month);
		this.year = Number(year);
	}

	get date() {
		return new Date(this.year, this.month, this.day);
	}

	get week() {
		return FancyDate.getWeekNumber(this.date);
	}

	get weekDay() {
		return this.date.getDay();
	}

	isGreaterThan(date) {
		if (this.year > date.year) return true;
		if (this.month > date.month) return true;
		if (this.day > date.day) return true;
		return false;
	}

	isLessThan(date) {
		if (this.year < date.year) return true;
		if (this.month < date.month) return true;
		if (this.day < date.day) return true;
		return false;
	}

	isSameOrGreaterThan(date) {
		return this.isGreaterThan(date) || this.isEqualTo(date);
	}

	isSameOrLessThan(date) {
		return this.isLessThan(date) || this.isEqualTo(date);
	}

	isEqualTo(date) {
		return this.year == date.year && this.month == date.month && this.day == date.day;
	}

	inPast() {
		return this.isLessThan(FancyDate.getToday());
	}

	inFuture() {
		return this.isGreaterThan(FancyDate.getToday());
	}

	isToday() {
		return this.isEqualTo(FancyDate.getToday());
	}

	toString() {
		return `${this.year}-${this.month + 1}-${this.day}`;
	}

	toJSON() {
		return {
			day: this.day,
			month: this.month,
			year: this.year
		};
	}

	valueOf() {
		return this.date.valueOf();
	}

	static fromString(str) {
		if (str.match(/^\d+$/)) {
			let now = new Date();
			return new FancyDate(Number(str), now.getMonth(), now.getFullYear());
		}
		return FancyDate.fromDate(new Date(str));
	}

	static fromDate(date) {
		return new FancyDate(date.getDate(), date.getMonth(), date.getFullYear());
	}

	static getToday() {
		let now = new Date();
		return FancyDate.fromDate(now);
	}

	static getTomorrow() {
		let now = new Date();
		now.setDate(now.getDate() + 1);
		return FancyDate.fromDate(now);
	}

	static getYesterday() {
		let now = new Date();
		now.setDate(now.getDate() - 1);
		return FancyDate.fromDate(now);
	}

	static getWeekNumber(date) {// https://stackoverflow.com/a/6117889
		if (date instanceof FancyDate) date = date.date;
		// Copy date so don't modify original
		let d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
		// Set to nearest Thursday: current date + 4 - current day number
		// Make Sunday's day number 7
		d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
		// Get first day of year
		var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
		// Calculate full weeks to nearest Thursday
		var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
		// Return array of year and week number
		return [d.getUTCFullYear(), weekNo];
	}

}