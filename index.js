import config from './config.js';

import Telegram from 'node-telegram-bot-api';
import JsonDB from './database.js';
import Cron from './cron.js';
import { ping, start, id, help } from './commands/utils.js';
import { book, bookings, removebooking, copyfromlastweek } from './commands/bookings.js';
import { setname, adduser, removeuser, users, disablereminder, enablereminder, setremindertime } from './commands/users.js';
import { previeweeklymessage, setannouncementchannel, sendweeklymessage, setweeklymessagetime } from './commands/weeklyMessage.js';

export const chatState = {};

export const client = new Telegram(config.telegramApiKey, {polling: true});
export const db = new JsonDB({ path: './db.json' });
export const cron = new Cron();

export const commands = {
	// utils
	ping,
	start,
	id,
	help,

	// bookings
	book,
	bookings,
	removebooking,
	copyfromlastweek,

	// users
	setname,
	adduser,
	removeuser,
	users,
	disablereminder,
	enablereminder,
	setremindertime,

	// weekly message
	previeweeklymessage,
	setannouncementchannel,
	sendweeklymessage,
	setweeklymessagetime,
}

client.on('message', async (msg) => {
	if (msg.from.is_bot) return;
	let isPrivate = msg.chat.type == 'private';
	let user = db.getUser(msg.from.id);
	if (user != undefined && user.username == undefined) {
		db.updateUser(msg.from.id, {username: msg.from.username, name: msg.from.first_name});
	}
	if (chatState[msg.chat.id] != undefined) {
		if (msg.text == 'cancel' || msg.text == '/cancel') {
			delete chatState[msg.chat.id];
			client.sendMessage(msg.chat.id, 'Operation cancelled!', {message_thread_id: msg.message_thread_id});
			return;
		} else {
			commands[chatState[msg.chat.id].command].execute(msg);
		}
	} else {
		if (!msg.text || msg.text.indexOf('/') !== 0) return;
		const args = msg.text.slice(1).trim().split(/ +/g);
		const command = args.shift().toLowerCase();
		const cmdHandler = commands[command];
		if (cmdHandler != undefined) {
			if (cmdHandler.requireAdmin && user == undefined) {
				if (isPrivate) {
					client.sendMessage(msg.chat.id, 'You are not authorized to use this command!', {message_thread_id: msg.message_thread_id});
					return;
				} // else ignore, might be trying to use another bot
			}
			if (isPrivate && !cmdHandler.canRunPrivate) {
				client.sendMessage(msg.chat.id, 'This command cannot be run in private!', {message_thread_id: msg.message_thread_id});
				return;
			}
			if (!isPrivate && !cmdHandler.canRunPublic) {
				client.sendMessage(msg.chat.id, 'This command cannot be run in public!', {message_thread_id: msg.message_thread_id});
				return;
			}
			cmdHandler.execute(msg, args);
		}
	}
});

process.on('uncaughtException', function(err) {
	console.log('Caught exception: ' + err + '\n' + err.stack);
});

// disabled for now cause it makes the bot never shut down
/*process.on('SIGINT', () => { // attempt to save the database when the process is terminated
	db.save();
	client.close();
});*/

client.getMyName().then(name => {
	console.log('Logged in as ' + name.name);
});