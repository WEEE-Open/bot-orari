import { db, client, commands } from '../index.js';

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
		client.sendMessage(msg.chat.id, message, {message_thread_id: msg.message_thread_id});
	}
}