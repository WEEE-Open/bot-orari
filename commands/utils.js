import { db, client, commands, cron } from '../index.js';
import fs from "fs/promises";
import Time from '../time.js';

export const ping = {
	name: 'ping',
	description: 'Ping!',
	canRunPublic: true,
	canRunPrivate: true,
	requireAdmin: false,
	execute(msg, args) {
		client.sendMessage(msg.chat.id, 'Pong!', {message_thread_id: msg.message_thread_id});
	}
}

export const start = {
	name: 'start',
	description: 'Start chatting',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: false,
	execute(msg, args) {
		let user = db.getUser(msg.from.id);
		if (user == undefined) {
			client.sendMessage(msg.chat.id, 'User is not yet autorized! Run the /id command and send the code to an admin so that they can add you.', {message_thread_id: msg.message_thread_id});
			return;
		}
	}
}

export const id = {
	name: 'id',
	description: 'Get your user id',
	canRunPublic: true,
	canRunPrivate: true,
	requireAdmin: false,
	execute(msg, args) {
		client.sendMessage(msg.chat.id, msg.from.id, {message_thread_id: msg.message_thread_id});
	}
}

export const help = {
	name: 'help',
	description: 'Get help',
	canRunPublic: true,
	canRunPrivate: true,
	requireAdmin: false,
	execute(msg, args) {
		let message = '';
		Object.values(commands).forEach(command => {
			message += `/${command.name} - ${command.description}\n`;
		});
		message += '\n\nTo interrup a command, use /cancel';
		client.sendMessage(msg.chat.id, message, {message_thread_id: msg.message_thread_id});
	}
}

export const commit = {
	name: 'commit',
	description: 'Check commit version',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: false,
	async execute(msg, args) {
		fs.readFile("./.git/HEAD").then((commit)=>{
			if (/^[a-f0-9]{40}$/i.test(String(commit).toString().trim())) {
				client.sendMessage(msg.chat.id, "Last commit hash: " + commit.toString().trim(), {message_thread_id: msg.message_thread_id});
			} else {
				fs.readFile("./.git/" + String(commit).substring(5).trim()).then((commit)=>{
					if (/^[a-f0-9]{40}$/i.test(String(commit).toString().trim())) {
						client.sendMessage(msg.chat.id, "Last commit hash: " + commit.toString().trim(), {message_thread_id: msg.message_thread_id});
					} else {
						console.log("no git head file found", err);
						client.sendMessage(msg.chat.id, "Can't retreive last commit hash", {message_thread_id: msg.message_thread_id});
					}
				}).catch((err)=>{
					console.log("no git head file found", err);
					client.sendMessage(msg.chat.id, "Can't retreive last commit hash", {message_thread_id: msg.message_thread_id});
				});
			}
		}).catch((err)=>{
			console.log("no git head file found", err);
			client.sendMessage(msg.chat.id, "Can't retreive last commit hash", {message_thread_id: msg.message_thread_id});
		});
	}
}

export const status = {
	name: 'status',
	description: 'Check status',
	canRunPublic: false,
	canRunPrivate: true,
	requireAdmin: true,
	async execute(msg, args) {
		let reminderCron = cron.reminderJob;
		let announcementCron = cron.announcementJob;
		let message = '';
		if (reminderCron != null) {
			let nextReminder = reminderCron.nextInvocation();
			let time = Time.fromDate(nextReminder);
			message += `The reminder message is sent on ${['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][nextReminder.getDay()]} at ${time.toString()}, next execution on ${nextReminder.getFullYear()}-${nextReminder.getMonth() + 1}-${nextReminder.getDate()}.\n\n`;
		} else {
			message += "The reminder message is currently disabled.\n\n";
		}
		if (announcementCron != null) {
			let nextAnnouncement = announcementCron.nextInvocation();
			let time = Time.fromDate(nextAnnouncement);
			message += `The weekly message is sent on ${['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][nextAnnouncement.getDay()]} at ${time.toString()}, next execution on ${nextAnnouncement.getFullYear()}-${nextAnnouncement.getMonth() + 1}-${nextAnnouncement.getDate()}.`;
		} else {
			message += "The weekly message is currently disabled.";
		}
		client.sendMessage(msg.chat.id, message, {message_thread_id: msg.message_thread_id});
	}
}