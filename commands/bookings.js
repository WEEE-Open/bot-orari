import FancyDate from '../date.js';
import { db, client, chatState } from '../index.js';
import Time from '../time.js';
import { updateWeeklyMessage } from './weeklyMessage.js';
import { userToLink } from '../utils.js';

export const book = {
	name: 'book',
	description: 'Book a room',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: true,
	async execute(msg, args) {
		if (chatState[msg.chat.id] == undefined) chatState[msg.chat.id] = {command: 'book', date: null, timeStart: null, timeEnd: null};

		if (args == undefined) { // answeting a previous question
			if (chatState[msg.chat.id].date == undefined) {
				args = [msg.text];
			} else if (chatState[msg.chat.id].timeStart == undefined) {
				args = [null, msg.text];
			} else if (chatState[msg.chat.id].timeEnd == undefined) {
				args = [null, null, msg.text];
			}
		}
		
		if (args[0] != undefined) {
			try {
				let date = FancyDate.fromString(args[0]);
				if (date.inPast()) {
					client.sendMessage(msg.chat.id, 'You can\'t book in the past!', {message_thread_id: msg.message_thread_id});
					chatState[msg.chat.id].date = null;
				} else {
					chatState[msg.chat.id].date = date;
				}
			} catch (e) {
				client.sendMessage(msg.chat.id,	'Invalid date!', {message_thread_id: msg.message_thread_id});
			}
		}

		if (args[1] != undefined) {
			try {
				chatState[msg.chat.id].timeStart = Time.fromString(args[1]);
			} catch (e) {
				client.sendMessage(msg.chat.id, 'Invalid start time!', {message_thread_id: msg.message_thread_id});
			}
		}

		if (args[2] != undefined) {
			try {
				chatState[msg.chat.id].timeEnd = Time.fromString(args[2]);
				if (chatState[msg.chat.id].timeEnd.isBefore(chatState[msg.chat.id].timeStart)) {
					client.sendMessage(msg.chat.id, 'Your end time is before your start time!', {message_thread_id: msg.message_thread_id});
					chatState[msg.chat.id].timeEnd = null;
				}
			} catch (e) {
				client.sendMessage(msg.chat.id, 'Invalid end time!', {message_thread_id: msg.message_thread_id});
			}
		}

		if (chatState[msg.chat.id].date == undefined) {
			client.sendMessage(msg.chat.id, 'What date would you like to book? (YYYY-MM-DD)(DD)', {message_thread_id: msg.message_thread_id});
		} else if (chatState[msg.chat.id].timeStart == undefined) {
			client.sendMessage(msg.chat.id, 'What time would you like to start? (HH:MM)', {message_thread_id: msg.message_thread_id});
		} else if (chatState[msg.chat.id].timeEnd == undefined) {
			client.sendMessage(msg.chat.id, 'What time would you like to end? (HH:MM)', {message_thread_id: msg.message_thread_id});
		} else {
			db.addBooking({
				userId: msg.from.id,
				date: chatState[msg.chat.id].date,
				timeStart: chatState[msg.chat.id].timeStart,
				timeEnd: chatState[msg.chat.id].timeEnd
			});
			client.sendMessage(msg.chat.id, 'Your booking has been added for ' + chatState[msg.chat.id].date.toString() + ' from ' + chatState[msg.chat.id].timeStart.toString() + ' to ' + chatState[msg.chat.id].timeEnd.toString() + '!', {message_thread_id: msg.message_thread_id});
			delete chatState[msg.chat.id];
			if (await updateWeeklyMessage()) {
				client.sendMessage(msg.chat.id, 'Announcement message updated!', {message_thread_id: msg.message_thread_id});
			}
		}
	}
}

export const bookings = {
	name: 'bookings',
	description: 'View your bookings',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: true,
	execute(msg, args) {
		let bookings;
		if (args != undefined && args[0] == "all") {
			bookings = db.getBookings();
			if (bookings.length == 0) {
				client.sendMessage(msg.chat.id, "There are no bookings", {message_thread_id: msg.message_thread_id});
				return;
			}
			let users = db.getUsersMap();
			let message = '';
			for (let booking of bookings) {
				message += `- ${userToLink(users[booking.userId])} ${booking.date.toString()} ${booking.timeStart.toString()} - ${booking.timeEnd.toString()}\n`;
			}
			client.sendMessage(msg.chat.id, message, {parse_mode: 'HTML', message_thread_id: msg.message_thread_id});
		} else {
			bookings = db.getBookingsByUser(msg.from.id);
			if (bookings.length == 0) {
				client.sendMessage(msg.chat.id, "You have no bookings", {message_thread_id: msg.message_thread_id});
				return;
			}
			let message = '';
			for (let booking of bookings) {
				message += `- ${booking.date.toString()} ${booking.timeStart.toString()} - ${booking.timeEnd.toString()}\n`;
			}
			client.sendMessage(msg.chat.id, message, {parse_mode: 'HTML', message_thread_id: msg.message_thread_id});
		}
	}
}

export const removebooking = {
	name: 'removebooking',
	description: 'Remove a booking',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: true,
	async execute(msg, args) {
		if (chatState[msg.chat.id] == undefined) 
			chatState[msg.chat.id] = {command: 'removebooking', date: null, timeStart: null};
		if (args == undefined && msg.text != undefined && msg.text != '') {
			if (chatState[msg.chat.id].date	== undefined)
				args = [msg.text];
			else if (chatState[msg.chat.id].timeStart == undefined)
				args = [null, msg.text];
		}
		if (args[0] != undefined) {
			try {
				let date = new FancyDate(args[0]);
				if (date.inPast()) {
					client.sendMessage(msg.chat.id, 'You can\'t delte bookings in the past!', {message_thread_id: msg.message_thread_id});
					chatState[msg.chat.id].date = null;
				} else {
					chatState[msg.chat.id].date = date;
					let bookingsByDateByUser = db.getBookingsByDateByUser(chatState[msg.chat.id].date, msg.from.id);
					if (bookingsByDateByUser.length == 0) {
						client.sendMessage(msg.chat.id, 'You have no bookings for that date!', {message_thread_id: msg.message_thread_id});
						chatState[msg.chat.id].date = null;
					} else if (bookingsByDateByUser.length == 1) {
						chatState[msg.chat.id].timeStart = bookingsByDateByUser[0].timeStart;
					}
				}
			} catch (e) {
				client.sendMessage(msg.chat.id,	'Invalid date!', {message_thread_id: msg.message_thread_id});
			}
		}
		if (args[1] != undefined) {
			try {
				chatState[msg.chat.id].timeStart = Time.fromString(args[1]);
			} catch (e) {
				client.sendMessage(msg.chat.id, 'Invalid start time!', {message_thread_id: msg.message_thread_id});
			}
		}
		let bookings = db.getBookingsByUser(msg.from.id).filter(booking => !booking.date.inPast());
		if (args.length == 0) {
			if (bookings.length == 0) {
				client.sendMessage(msg.chat.id, "You have no bookings", {message_thread_id: msg.message_thread_id});
				delete chatState[msg.chat.id];
				return;
			}
			if (bookings.length == 1) {
				chatState[msg.chat.id].date = bookings[0].date;
				chatState[msg.chat.id].timeStart = bookings[0].timeStart;
			} else {
				let message = 'Your current bookings:\n\n';
				for (let booking of bookings) {
					message += `- ${booking.date.toString()} ${booking.timeStart.toString()} - ${booking.timeEnd.toString()}\n`;
				}
				client.sendMessage(msg.chat.id, message, {parse_mode: 'HTML', message_thread_id: msg.message_thread_id});
			}
		}
		if (chatState[msg.chat.id].date == undefined) {
			client.sendMessage(msg.chat.id, 'Please enter the date of the booking to remove:', {message_thread_id: msg.message_thread_id});
		} else {
			if (chatState[msg.chat.id].timeStart == undefined) {
				client.sendMessage(msg.chat.id, 'Please enter the start time of the booking to remove:', {message_thread_id: msg.message_thread_id});
			} else {
				let booking = bookings.find(booking => booking.date.isEqualTo(chatState[msg.chat.id].date) && booking.timeStart.isSame(chatState[msg.chat.id].timeStart));
				if (booking != undefined) {
					db.removeBooking(chatState[msg.chat.id].date, chatState[msg.chat.id].timeStart);
					client.sendMessage(msg.chat.id, 'Booking removed!', {message_thread_id: msg.message_thread_id});
					if (await updateWeeklyMessage()) {
						client.sendMessage(msg.chat.id, 'Announcement message updated!', {message_thread_id: msg.message_thread_id});
					}
				} else {
					client.sendMessage(msg.chat.id, 'You don\'t have a booking for that date!', {message_thread_id: msg.message_thread_id});
				}
				delete chatState[msg.chat.id];
			}
		}
	}
}

export const copyfromlastweek = {
	name: 'copyfromlastweek',
	description: 'Copy bookings from last week',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: true,
	async execute(msg, args) {
		client.sendMessage(msg.chat.id, 'Feature currently disabled', {message_thread_id: msg.message_thread_id});
		return;
		let now = new Date();
		let nowWeek = getWeekNumberFromDate(now);
		let lastWeek = getWeekNumberFromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7));
		let nextWeek = getWeekNumberFromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
		let bookingsThisWeek = db.getBookingsByWeek(...nowWeek);
		let bookingsLastWeek = db.getBookingsByWeek(...lastWeek);
		let bookingsNextWeek = db.getBookingsByWeek(...nextWeek);
		let bookingsToAdd = [];
		if (bookingsNextWeek.length == 0 && bookingsThisWeek.length == 0) {
			bookingsToAdd = bookingsLastWeek;
		} else if (bookingsNextWeek.length == 0) {
			bookingsToAdd = bookingsThisWeek;
		} else {
			bookingsToAdd = bookingsNextWeek;
		}
		if (bookingsToAdd.length == 0) {
			client.sendMessage(msg.chat.id, 'No bookings to copy!', {message_thread_id: msg.message_thread_id});
			return;
		}
		bookingsToAdd.forEach((b) => {
			let newDate = new Date(b.date);
			newDate.setDate(newDate.getDate() + 7);
			db.addBooking({
				userId: msg.from.id,
				date: newDate,
				timeStart: new Time(b.timeStart),
				timeEnd: new Time(b.timeEnd)
			})
		});
		let message = 'Bookings copied:\n\n';
		for (let booking of bookingsToAdd) {
			message += `- ${formatDate(booking.date)} ${booking.timeStart.toString()} - ${booking.timeEnd.toString()}\n`;
		}
		client.sendMessage(msg.chat.id, message, {parse_mode: 'HTML', message_thread_id: msg.message_thread_id});
		if (await updateWeeklyMessage()) {
			client.sendMessage(msg.chat.id, 'Announcement message updated!', {message_thread_id: msg.message_thread_id});
		}
	}
}
