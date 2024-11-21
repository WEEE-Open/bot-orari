import fs from 'fs';

import Time from './time.js';
import FancyDate from './date.js';
import { isJsonString } from './utils.js';

export default class JsonDB {

    constructor (config) {
        this.filePath = config.path || './db.json';
        this.updateRate = config.updateRate || 5000;

        if (fs.existsSync(this.filePath)) {
            let file = fs.readFileSync(this.filePath);
            if (!isJsonString(file)) {
                throw `[database] "${this.filePath}" is not a valid json file, please either fix this or delete it so that a new one will be created`;
            } else {
                this.db = JSON.parse(file);
            }
        } else {
            console.log(`[database] "${this.filePath} does not exist, creating...`);
            fs.writeFileSync(this.filePath, "{}");
            this.db = {}
        }

        this.updated = false;

        this.update = () => { // this function will accumulate changes before updating the db file, this reduces the ammound of times the file is written without compromising too much on insuring that the data is saved, since this is a selfhosted app acid compliance is not essential 
            if (this.updated == true) return;
            this.updated = true;
            this.saveTimeout = setTimeout(async () => {
                this.save();
            }, this.updateRate);
        }

        this.db.currentWeekMessageId = this.db.currentWeekMessageId || null;
		if (this.db.currentWeekMessageLastTime != null){
			try {
				this.db.currentWeekMessageLastTime = new Date(this.db.currentWeekMessageLastTime);
			} catch (e) {
				this.db.currentWeekMessageLastTime = null;
			}
		}
		this.db.announcementChannel = this.db.announcementChannel || null;
		this.db.weeklyMessage = this.db.weeklyMessage || {};
		if (this.db.weeklyMessage.time != null) this.db.weeklyMessage.time = new Time(...this.db.weeklyMessage.time);
		else this.db.weeklyMessage.time = null;
		if (this.db.weeklyMessage.weekday != null) this.db.weeklyMessage.weekday = this.db.weeklyMessage.weekday; // js standard order aka 0 = sunday, 1 = monday, etc
		else this.db.weeklyMessage.weekday = null;
		this.db.reminderMessage = this.db.reminderMessage || {};
		if (this.db.reminderMessage.time != null) this.db.reminderMessage.time = new Time(...this.db.reminderMessage.time);
		else this.db.reminderMessage.time = null;
		if (this.db.reminderMessage.weekday != null) this.db.reminderMessage.weekday = this.db.reminderMessage.weekday; // js standard order aka 0 = sunday, 1 = monday, etc
		else this.db.reminderMessage.weekday = null;
		this.db.weeklyMessageWeek = this.db.weeklyMessageWeek || null;
		this.db.weeklyMessageText = this.db.weeklyMessageText || null;
		this.db.bookings = this.db.bookings || [];
		this.db.bookings.map(booking => {
			if (typeof booking.date == "string")
				booking.date = FancyDate.fromString(booking.date); // backwards compatibility
			else booking.date = new FancyDate(booking.date);
			booking.timeStart = new Time(...booking.timeStart);
			booking.timeEnd = new Time(...booking.timeEnd);
			return booking;
		});
		let aWeekAgo = new Date();
		aWeekAgo.setDate(aWeekAgo.getDate() - 7);
		aWeekAgo = new FancyDate(aWeekAgo);
		this.db.bookings = this.db.bookings.filter(booking => booking.date.isSameOrGreaterThan(aWeekAgo));
		this.sortBookings();
		this.db.users = this.db.users || [];

        this.update();
    }

	save() {
		clearTimeout(this.saveTimeout);
		fs.writeFile(this.filePath, JSON.stringify(this.db, null, 3), (err) => {
			if (err)
				throw `[database] Error when updating databade: ${err}`;
		});
		this.updated = false;
	}

	getBookings() {
		return this.db.bookings;
	}
	
	getBookingsByUser(userId, past = false) {
		let now = new FancyDate();
		return this.db.bookings.filter(booking => {
			return booking.userId == userId && (past || booking.date.isSameOrGreaterThan(now));
		});
	}

	/**
	 * @param {object} booking 
	 * @param {Date} booking.date
	 * @param {Time} booking.timeStart
	 * @param {Time} booking.timeEnd
	 * @param {String|Number} booking.userId
	 */
	addBooking(booking) {
		this.db.bookings.push(booking);
		this.sortBookings();
		this.update();
	}

	/**
	 * Internal function to sort bookings by date and time, always run this after adding/updating booking
	 * 
	 * @private
	 */
	sortBookings() {
		this.db.bookings.sort((a, b) => {
			if (a.date.isLessThan(b.date)) return -1;
			if (b.date.isLessThan(a.date)) return 1;
			if (a.timeStart.isBefore(b.timeStart)) return -1;
			if (b.timeStart.isBefore(a.timeStart)) return 1;
			if (a.timeEnd.isBefore(b.timeEnd)) return -1;
			if (b.timeEnd.isBefore(a.timeEnd)) return 1;
			return 0;
		});
	}

	removeBooking(date, timeStart) {
		this.db.bookings = this.db.bookings.filter(booking => !(booking.date.isEqualTo(date) && booking.timeStart.isSame(timeStart)));
		this.update();
	}

	getBookingsByWeek(year, week) {
		return this.db.bookings.filter(booking => {
			let bookingWeek = booking.date.week;
			return bookingWeek[0] == year && bookingWeek[1] == week;
		});
	}

	getBookingsByWeekByUser(year, week, userId) {
		return this.db.bookings.filter(booking => {
			let bookingWeek = booking.date.getWeekNumber();
			return bookingWeek[0] == year && bookingWeek[1] == week && booking.userId == userId;
		});
	}

	getBookingsByDate(date) {
		return this.db.bookings.filter(booking => booking.date.isEqualTo(date));
	}

	getBookingsByDateByUser(date, userId) {
		return this.db.bookings.filter(booking => booking.date.isEqualTo(date) && booking.userId == userId);
	}

	getUsers() {
		return this.db.users;
	}

	getUser(id) {
		return this.db.users.find(user => user.id == id);
	}

	getUsersMap() {
		let users = {};
		this.db.users.forEach(user => {
			users[user.id] = user;
		});
		return users;
	}

	addUser(user) {
		this.db.users.push({sendReminderNotification: true, ...user});
		this.update();
	}

	updateUser(id, user) {
		this.db.users = this.db.users.map(u => {
			if (u.id == id) return {...u, ...user};
			return u;
		});
		this.update();
	}

	enableReminderNotification(id) {
		this.db.users = this.db.users.map(user => {
			if (user.id == id) return {...user, sendReminderNotification: true};
			return user;
		});
		this.update();
	}

	disableReminderNotification(id) {
		this.db.users = this.db.users.map(user => {
			if (user.id == id) return {...user, sendReminderNotification: false};
			return user;
		});
		this.update();
	}

	removeUser(id) {
		this.db.users = this.db.users.filter(user => user.id != id);
		this.update();
	}

	getUserByUsername(username) {
		return this.db.users.find(user => user.username == username);
	}

	getAnnouncementChannel() {
		return this.db.announcementChannel;
	}

	setAnnouncementChannel(id) {
		this.db.announcementChannel = id;
		this.update();
	}

	setWeekMessageId(id) {
		this.db.currentWeekMessageId = id;
		this.update();
	}

	getWeekMessageId() {
		return this.db.currentWeekMessageId;
	}

	setWeekMessageLastTime(time) {
		this.db.currentWeekMessageLastTime = time;
		this.update();
	}

	getWeekMessageLastTime() {
		return this.db.currentWeekMessageLastTime;
	}

	setWeeklyMessageTime(time) {
		this.db.weeklyMessage.time = time;
		this.update();
	}

	getWeeklyMessageTime() {
		return this.db.weeklyMessage.time;
	}

	setWeeklyMessageWeekday(weekday) {
		this.db.weeklyMessage.weekday = weekday;
		this.update();
	}

	getWeeklyMessageWeekday() {
		return this.db.weeklyMessage.weekday;
	}

	setReminderMessageTime(time) {
		this.db.reminderMessage.time = time;
		this.update();
	}

	getReminderMessageTime() {
		return this.db.reminderMessage.time;
	}

	setReminderMessageWeekday(weekday) {
		this.db.reminderMessage.weekday = weekday;
		this.update();
	}

	getReminderMessageWeekday() {
		return this.db.reminderMessage.weekday;
	}

	setWeeklyMessageWeek(week) {
		this.db.weeklyMessageWeek = week;
		this.update();
	}

	getWeeklyMessageWeek() {
		return this.db.weeklyMessageWeek;
	}

	setWeeklyMessageText(text) {
		this.db.weeklyMessageText = text;
		this.update();
	}

	getWeeklyMessageText() {
		return this.db.weeklyMessageText;
	}
}
