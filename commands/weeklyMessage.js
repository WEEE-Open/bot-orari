import { db, client, chatState, cron } from '../index.js';
import Time from '../time.js';
import { getWeekNumberFromDate } from '../utils.js';

export const previeweeklymessage = {
	name: 'previeweeklymessage',
	description: 'Preview the weekly message',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: true,
	execute(msg, args = []) {
		let offset = parseInt(args[0]) || 0;
		let date = new Date();
		date.setDate(date.getDate() + offset*7);
		let bookings = db.getBookingsByWeek(...getWeekNumberFromDate(date));
		let message = generateScheduleMessage(bookings);
		client.sendMessage(msg.chat.id, message, {parse_mode: 'HTML', disable_web_page_preview: true, message_thread_id: msg.message_thread_id});
	}
}

export const setannouncementchannel = {
	name: 'setannouncementchannel',
	description: 'Set the channel to send the weekly message to',
	canRunPublic: true,
	canRunPrivate: true,
	requireAdmin: true,
	async execute(msg, args) {
		client.deleteMessage(msg.chat.id, msg.message_id);
		let id = msg.chat.id;
		if (msg.message_thread_id != undefined) id += ':' + msg.message_thread_id;
		if (args != undefined && args[0] == 'off') {
			db.setAnnouncementChannel(null);
			let confirmation = await client.sendMessage(msg.chat.id, 'Channel unset! (self-destructing in 5s)', {message_thread_id: msg.message_thread_id, disable_notification: true});
			setTimeout(() => {
				client.deleteMessage(confirmation.chat.id, confirmation.message_id);
			}, 5000);
			return;
		}
		db.setAnnouncementChannel(id);
		let confirmation = await client.sendMessage(msg.chat.id, 'Channel set! (self-destructing in 5s)', {message_thread_id: msg.message_thread_id, disable_notification: true});
		setTimeout(() => {
			client.deleteMessage(confirmation.chat.id, confirmation.message_id);
		}, 5000);
	}
}

export const sendweeklymessage = {
	name: 'sendweeklymessage',
	description: 'Send the weekly message',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: true,
	async execute(msg, args) {
		let id = db.getAnnouncementChannel();
		if (id == null) {
			client.sendMessage(msg.chat.id, 'No announcement channel set! Use /setannouncementchannel to set one.', {message_thread_id: msg.message_thread_id});
			return;
		}
		let force = false;
		if (args != undefined && args[0] == 'force') force = true;
		if (args == undefined) {
			if (['y', 'yes'].includes(msg.text.toLowerCase())) force = true;
			else if (['n', 'no'].includes(msg.text.toLowerCase())) {
				delete chatState[msg.chat.id];
				client.sendMessage(msg.chat.id, 'Cancelled.', {message_thread_id: msg.message_thread_id});
				return;
			}
		}
		let lastTime = db.getWeekMessageLastTime();
		if (lastTime != null) {
			let now = new Date();
			if (now - lastTime < 1000*60*60*24*7 && !force) {
				chatState[msg.chat.id] = {command: 'sendweeklymessage'};
				client.sendMessage(msg.chat.id, 'The last weekly message was sent less than a week ago! Are you sure you want to send another one? (y/n)', {message_thread_id: msg.message_thread_id});
				return;
			}
		}
		let [channelId, threadId] = (""+ id).split(':');
		let now = new Date();
		let bookings = db.getBookingsByWeek(...getWeekNumberFromDate(now));
		let newWeeklyMessage = await client.sendMessage(channelId, generateScheduleMessage(bookings), {parse_mode: 'HTML', disable_web_page_preview: true, message_thread_id: threadId});
		db.setWeekMessageLastTime(now);
		db.setWeekMessageId(newWeeklyMessage.message_id);
		client.sendMessage(msg.chat.id, 'Message sent!', {message_thread_id: msg.message_thread_id});
		delete chatState[msg.chat.id];
	}
}

export const setweeklymessagetime = {
	name: 'setweeklymessagetime',
	description: 'Set the time and day of the week to send the weekly message',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: true,
	async execute(msg, args) {
		if (args != undefined && args[0] == 'off') {
			db.setWeeklyMessageTime(null);
			db.setWeeklyMessageWeekday(null);
			client.sendMessage(msg.chat.id, 'Weekly message time unset!', {message_thread_id: msg.message_thread_id});
			cron.updateAnnouncementJob();
			return;
		}

		if (chatState[msg.chat.id] == undefined) 
			chatState[msg.chat.id] = {command: 'setweeklymessagetime', time: null, weekday: null};

		if (args == undefined && msg.text != undefined && msg.text != '') {
			if (chatState[msg.chat.id].weekday == undefined)
				args = [msg.text];
			else if (chatState[msg.chat.id].time == undefined)
				args = [null, msg.text];
		}

		if (args[0] != undefined && args[0] != '') {
			if (args[0].match(/^\d+$/)) {
				chatState[msg.chat.id].weekday = parseInt(args[0])%7;
			} else {
				let options = {
					'sunday': 0,
					'sun': 0,
					'monday': 1,
					'mon': 1,
					'tuesday': 2,
					'tue': 2,
					'wednesday': 3,
					'wed': 3,
					'thursday': 4,
					'thu': 4,
					'friday': 5,
					'fri': 5,
					'saturday': 6,
					'sat': 6,
				};
				if (options[args[0].toLowerCase()] != undefined) {
					chatState[msg.chat.id].weekday = options[args[0].toLowerCase()];
				} else {
					await client.sendMessage(msg.chat.id, 'Invalid weekday!', {message_thread_id: msg.message_thread_id});
				}
			}
		}
		if (args[1] != undefined && args[1] != '') {
			try {
				chatState[msg.chat.id].time = Time.fromString(args[1]);
			} catch (e) {
				await client.sendMessage(msg.chat.id, 'Invalid time!', {message_thread_id: msg.message_thread_id});
			}
		}

		if (chatState[msg.chat.id].time != undefined && chatState[msg.chat.id].weekday != undefined) {
			db.setWeeklyMessageTime(chatState[msg.chat.id].time);
			db.setWeeklyMessageWeekday(chatState[msg.chat.id].weekday);
			client.sendMessage(msg.chat.id, 'Weekly message time set!', {message_thread_id: msg.message_thread_id});
			delete chatState[msg.chat.id];
			cron.updateAnnouncementJob();
			return;
		} else if (chatState[msg.chat.id].time != undefined) {
			client.sendMessage(msg.chat.id, 'What day of the week should the message be sent? (0-6, monday, tue...)', {message_thread_id: msg.message_thread_id});
		} else {
			client.sendMessage(msg.chat.id, 'What time should the message be sent? (hh:mm)', {message_thread_id: msg.message_thread_id});
		}
	}
}

export async function sendNewWeeklyMessage() {
	let id = db.getAnnouncementChannel();
	if (id == null) return;
	let [channelId, threadId] = ("" + id).split(':');
	let now = new Date();
	let bookings = db.getBookingsByWeek(...getWeekNumberFromDate(now));
	let newWeeklyMessage = await client.sendMessage(channelId, generateScheduleMessage(bookings), {parse_mode: 'HTML', disable_web_page_preview: true, message_thread_id: threadId});
	db.setWeekMessageLastTime(now);
	db.setWeekMessageId(newWeeklyMessage.message_id);
}

export function updateWeeklyMessage() {
	let channel = db.getAnnouncementChannel();
	let id = db.getWeekMessageId();
	if (channel == null || id == null) return;
	let [channelId, threadId] = ("" + channel).split(':');
	let now = new Date();
	let bookings = db.getBookingsByWeek(...getWeekNumberFromDate(now));
	client.editMessageText(generateScheduleMessage(bookings), {parse_mode: 'HTML', disable_web_page_preview: true, message_id: id, chat_id: channelId}).catch((err) => {
		console.log("There was an error when trying to update the announcement message, this is probably fine as we don't check that changes actually happened, but just in case it's needed, here is the error", err);
	}); // we don't know if this is going to fail on not, telegram doesn't have an api to get an old message apparently
	db.setWeekMessageLastTime(now);
}

export function generateScheduleMessage(bookings) {
	if (bookings.length == 0) return 'Hi everyone. No one is scheduled yet to open the lab this week! There is still a chance that someone will open it, so check back later or message @weeelab_bot if someone is booked there!';
	let message = 'Hi everyone. Here are this week\'s opening schedule:\n\n';
	let days = {};
	bookings.forEach((booking) => {
		let d = "<b>" + ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][booking.date.getDay()] + "</b>, " + booking.date.getDate() + '/' + (booking.date.getMonth() + 1);
		if (!days[d]) days[d] = []
		days[d].push(booking);
	});
	Object.entries(days).forEach(([d, bookings], ) => {
		message += d + ':\n';
		bookings.forEach((booking) => {
			let user = db.getUser(booking.userId);
			let userlink = booking.userId; // emergency backup, should never happen
			if (user != undefined) {
				if (user.name != undefined) {
					if (user.username != undefined) userlink = '<a href="https://t.me/' + user.username + '">' + user.name+ '</a>';
					else userlink = user.name;
				} else if (user.username != undefined) userlink = '@' + user.username;
			}
			message += ' ▹ ' + userlink + ' from ' + booking.timeStart.toString() + ' to ' + booking.timeEnd.toString() + '\n';
		});
		message += '\n';
	});
	message += "IMPORTANT: Make sure to message @weeelab_bot to tell others you are coming, otherwise the lab might not open that day!";
	return message;
}