import { db, client, chatState, cron } from '../index.js';
import FancyDate from '../date.js';
import Time from '../time.js';
import { userToLink } from "../utils.js";

export const previeweeklymessage = {
	name: 'previeweeklymessage',
	description: 'Preview the weekly message',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: true,
	execute(msg, args = []) {
		let offset = parseInt(args[0]) || 1;
		let date = new Date();
		date.setDate(date.getDate() + offset*7);
		let bookings = db.getBookingsByWeek(...FancyDate.getWeekNumber(date));
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
		if (await sendNewWeeklyMessage())
			client.sendMessage(msg.chat.id, 'Weekly message sent!', {message_thread_id: msg.message_thread_id});
		else
			client.sendMessage(msg.chat.id, 'There was an error sending the weekly message! Did you remember to set the announcement channel?', {message_thread_id: msg.message_thread_id});
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
			delete chatState[msg.chat.id];
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
		} else if (chatState[msg.chat.id].weekday == undefined) {
			client.sendMessage(msg.chat.id, 'Please enter the weekday to send the weekly message on (0-6, monday, tue...):', {message_thread_id: msg.message_thread_id});
		} else if (chatState[msg.chat.id].time == undefined) {
			client.sendMessage(msg.chat.id, 'Please enter the time to send the weekly message at (hh:mm):', {message_thread_id: msg.message_thread_id});
		}
	}
}

export const forceupdateweeklymessage = {
	name: 'forceupdateweeklymessage',
	description: 'Force update the weekly message',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: true,
	async execute(msg, args) {
		if (await updateWeeklyMessage())
			client.sendMessage(msg.chat.id, 'Weekly message updated!', {message_thread_id: msg.message_thread_id});
		else
			client.sendMessage(msg.chat.id, 'There was an error updating the weekly message!', {message_thread_id: msg.message_thread_id});
	}
}

export async function sendNewWeeklyMessage() {
	let id = db.getAnnouncementChannel();
	if (id == null) return false;
	let [channelId, threadId] = ("" + id).split(':');
	let now = new Date();
	let week = new Date();
	if (now.getDay() == 0 || now.getDay() == 6) week.setDate(week.getDate() + 7);
	let bookings = db.getBookingsByWeek(...FancyDate.getWeekNumber(week));
	let message = generateScheduleMessage(bookings);
	let newWeeklyMessage = await client.sendMessage(channelId, message, {parse_mode: 'HTML', disable_web_page_preview: true, message_thread_id: threadId});
	db.setWeekMessageLastTime(now);
	db.setWeekMessageId(newWeeklyMessage.message_id);
	db.setWeeklyMessageWeek(week);
	db.setWeeklyMessageText(message);
	return true;
}

export async function updateWeeklyMessage() {
	let channel = db.getAnnouncementChannel();
	let id = db.getWeekMessageId();
	let week = db.getWeeklyMessageWeek();
	if (channel == null || id == null || week == null) return false;
	week = new Date(week);
	let [channelId, threadId] = ("" + channel).split(':');
	let now = new Date();
	let bookings = db.getBookingsByWeek(...FancyDate.getWeekNumber(week));
	let message = generateScheduleMessage(bookings);
	if (message == db.getWeeklyMessageText()) return false;
	await client.editMessageText(message, {parse_mode: 'HTML', disable_web_page_preview: true, message_id: id, chat_id: channelId}).catch((err) => {
		console.log("There was an error when trying to update the announcement message, this is probably fine as we don't check that changes actually happened, but just in case it's needed, here is the error", err);
	}); // we don't know if this is going to fail on not, telegram doesn't have an api to get an old message apparently
	db.setWeeklyMessageText(message);
	return true;
}

export function generateScheduleMessage(bookings) {
	if (bookings.length == 0) return 'Hi everyone. No one is scheduled yet to open the lab this week! There is still a chance that someone will open it, so check back later or message @weeelab_bot if someone is booked there!';
	let message = 'Hi everyone. Here are this week\'s opening schedule:\n\n';
	let days = {};
	bookings.forEach((booking) => {
		let d = booking.date.weekDay;
		if (!days[d]) days[d] = []
		days[booking.date.weekDay].push(booking);
	});
	Object.values(days).forEach((bookings) => {
		let d = "<b>" + ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][bookings[0].date.weekDay] + "</b>, " + bookings[0].date.day + '/' + (bookings[0].date.month + 1);
		message += d + ':\n';
		bookings.forEach((booking) => {
			let user = db.getUser(booking.userId);
			message += ' ▹ ' + (user ? userToLink(user) : booking.userId) + ' from ' + booking.timeStart.toString() + ' to ' + booking.timeEnd.toString() + '\n';
		});
		message += '\n';
	});
	message += "IMPORTANT: Make sure to message @weeelab_bot to tell others you are coming, otherwise the lab might not open that day!";
	return message;
}