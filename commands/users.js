import FancyDate from '../date.js';
import { db, client, chatState, cron } from '../index.js';
import Time from '../time.js';
import { updateWeeklyMessage } from './weeklyMessage.js';

export const addfirstuser = {
	name: 'addfirstuser',
	description: 'Add the first user',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: false,
	execute(msg, args) {
		if (db.getUsers().length != 0) {
			client.sendMessage(msg.chat.id, 'There are already users in this bot, use \\adduser to add a new user', {message_thread_id: msg.message_thread_id});
			return;
		}
		db.addUser({id: msg.from.id, username: msg.from.username, name: msg.from.first_name});
		client.sendMessage(msg.chat.id, 'User added!', {message_thread_id: msg.message_thread_id});
	}
}

export const setname = {
	name: 'setname',
	description: 'Set your name',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: false,
	async execute(msg, args) {
		if (args == undefined && msg.text != undefined && msg.text != '')
			args = [msg.text];
		if (args[0] != undefined && args[0].trim() != '') {
			db.updateUser(msg.from.id, {name: args.join(' ')});
			client.sendMessage(msg.chat.id, 'Name set to <b>' + args.join(' ') + '</b>', {parse_mode: 'HTML', message_thread_id: msg.message_thread_id});
			delete chatState[msg.chat.id];
			if (await updateWeeklyMessage()) {
				client.sendMessage(msg.chat.id, 'Announcement message updated!', {message_thread_id: msg.message_thread_id});
			}
			return;
		}
		chatState[msg.chat.id] = {command: 'setname'};
		client.sendMessage(msg.chat.id, 'Please enter your name:', {message_thread_id: msg.message_thread_id});
	}
}

export const adduser = {
	name: 'adduser',
	description: 'Add a user',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: true,
	execute(msg, args) {
		if (args == undefined && msg.text != undefined && msg.text != '')
			args = [msg.text];
		if (args[0] != undefined && args[0] != '') {
			if (db.getUser(args[0]) != undefined) {
				client.sendMessage(msg.chat.id, 'User already exists!', {message_thread_id: msg.message_thread_id});
				delete chatState[msg.chat.id];
				return;
			}
			db.addUser({id: args[0]});
			client.sendMessage(msg.chat.id, 'User added!', {message_thread_id: msg.message_thread_id});
			delete chatState[msg.chat.id];
			return;
		}
		chatState[msg.chat.id] = {command: 'adduser'};
		client.sendMessage(msg.chat.id, 'Please enter the user\'s id (you can ask the user to run /id on the bot to get it):', {message_thread_id: msg.message_thread_id});
	}
}

export const removeuser = {
	name: 'removeuser',
	description: 'Remove a user',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: true,
	execute(msg, args) {
		if (args == undefined && msg.text != undefined && msg.text != '')
			args = [msg.text];
		if (args[0] != undefined && args[0] != '') {
			let user = db.getUser(args[0]) || db.getUserByUsername(args[0]);
			if (user == undefined) {
				client.sendMessage(msg.chat.id, 'User does not exist!', {message_thread_id: msg.message_thread_id});
				return;
			}
			db.removeUser(user.id);
			client.sendMessage(msg.chat.id, 'User removed!', {message_thread_id: msg.message_thread_id});
			delete chatState[msg.chat.id];
			return;
		}
		chatState[msg.chat.id] = {command: 'removeuser'};
		client.sendMessage(msg.chat.id, 'Please enter the user\'s id or username:', {message_thread_id: msg.message_thread_id});
	}
}

export const users = {
	name: 'users',
	description: 'List all users',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: true,
	execute(msg, args) {
		let users = db.getUsers();
		let message = '';
		for (let user of users) {
			message += `- ${user.id} <b>${user.name}</b> (@${user.username})\n`;
		}
		client.sendMessage(msg.chat.id, message, {parse_mode: 'HTML', message_thread_id: msg.message_thread_id});
	}
}

export const enablereminder = {
	name: 'enablereminder',
	description: 'Enable reminders',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: true,
	execute(msg, args) {
		db.enableReminderNotification(msg.from.id);
		client.sendMessage(msg.chat.id, 'Reminders enabled!', {message_thread_id: msg.message_thread_id});
	}
}

export const disablereminder = {
	name: 'disablereminder',
	description: 'Disable reminders',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: true,
	execute(msg, args) {
		db.disableReminderNotification(msg.from.id);
		client.sendMessage(msg.chat.id, 'Reminders disabled!', {message_thread_id: msg.message_thread_id});
	}
}

export const setremindertime = {
	name: 'setremindertime',
	description: 'Set the time and day of the week to send reminders',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: true,
	async execute(msg, args) {
		if (args != undefined && args[0] == 'off') {
			db.setReminderMessageTime(null);
			db.setReminderMessageWeekday(null);
			client.sendMessage(msg.chat.id, 'Reminder time unset!', {message_thread_id: msg.message_thread_id});
			cron.updateReminderJob();
			delete chatState[msg.chat.id];
			return;
		}
		
		if (chatState[msg.chat.id] == undefined) 
			chatState[msg.chat.id] = {command: 'setremindertime', time: null, weekday: null};

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
			db.setReminderMessageTime(chatState[msg.chat.id].time);
			db.setReminderMessageWeekday(chatState[msg.chat.id].weekday);
			client.sendMessage(msg.chat.id, 'Reminder time set!', {message_thread_id: msg.message_thread_id});
			delete chatState[msg.chat.id];
			cron.updateReminderJob();
			return;
		} else if (chatState[msg.chat.id].weekday == undefined) {
			client.sendMessage(msg.chat.id, 'Please enter the weekday to send reminders on (0-6, monday, tue...):', {message_thread_id: msg.message_thread_id});
		} else if (chatState[msg.chat.id].time == undefined) {
			client.sendMessage(msg.chat.id, 'Please enter the time to send reminders at (hh:mm):', {message_thread_id: msg.message_thread_id});
		}
	}
}

export function sendReminderToAllUsers() {
	let date = new Date();
	date.setDate(date.getDate() + 7);
	let bookings = db.getBookingsByWeek(...FancyDate.getWeekNumber(date));
	let users = db.getUsers();
	for (let user of users) {
		if (user.sendReminderNotification && bookings.find(booking => booking.userId == user.id) == undefined) {
			client.sendMessage(user.id, 'You haven\'t yet submitted your availability for next week! Please do so by running /book, or if you are available with the same schedule as last week use the command /copyfromlastweek').catch(() => {});
		}
	}
}