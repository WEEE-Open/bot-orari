import timer from 'node-schedule';
import LdapClient from "ldapjs-client";
import { db } from './index.js';
import { sendNewWeeklyMessage } from './commands/weeklyMessage.js';
import { sendReminderToAllUsers } from './commands/users.js';

export default class Cron {
	constructor(config) {
		this.config = config;
		this.announcementJob = null;
		this.reminderJob = null;
		this.ldapSyncCron = null;

		if (config.ldap && config.ldap.updateCron) {
			this.syncLdap.bind(this)();
			this.ldapSyncCron = timer.scheduleJob(config.ldap.updateCron, this.syncLdap.bind(this));
		}

		this.updateAnnouncementJob();
		this.updateReminderJob();
	}

	updateAnnouncementJob() {
		let reminderTime = db.getWeeklyMessageTime();
		let reminderWeekday = db.getWeeklyMessageWeekday();
		if (this.announcementJob != null) {
			if (reminderTime != undefined && reminderWeekday != undefined) {
				this.announcementJob.reschedule({dayOfWeek: reminderWeekday, hour: reminderTime.hour, minute: reminderTime.minute});
			} else {
				this.announcementJob.cancel();
				this.announcementJob = null;
			}
		} else {
			if (reminderTime != undefined && reminderWeekday != undefined) {
				this.announcementJob = timer.scheduleJob({dayOfWeek: reminderWeekday, hour: reminderTime.hour, minute: reminderTime.minute}, sendNewWeeklyMessage);
			}
		}
	}

	updateReminderJob() {
		let weeklyTime = db.getReminderMessageTime();
		let weeklyWeekday = db.getReminderMessageWeekday();
		if (this.reminderJob != null) {
			if (weeklyTime != undefined && weeklyWeekday != undefined) {
				this.reminderJob.reschedule({dayOfWeek: weeklyWeekday, hour: weeklyTime.hour, minute: weeklyTime.minute});
			} else {
				this.reminderJob.cancel();
				this.reminderJob = null;
			}
		} else {
			if (weeklyTime != undefined && weeklyWeekday != undefined) {
				this.reminderJob = timer.scheduleJob({dayOfWeek: weeklyWeekday, hour: weeklyTime.hour, minute: weeklyTime.minute}, sendReminderToAllUsers);
			}
		}
	}

	async syncLdap() {
		console.log(`Connecting to LDAP server at ${this.config.ldap.url}...`);
		this.client = new LdapClient({ url: this.config.ldap.url, timeout: this.config.ldap.timeout });
		await this.client.bind(this.config.ldap.username, this.config.ldap.password);
		let updatedUsers = await this.client.search(this.config.ldap.userDn, {
			scope: "sub",
			filter: "(&(!(nsAccountLock=*))(hasKey=TRUE))",
			attributes: [
				"cn",
				"telegramID",
				"telegramnickname",
			],
		});
		let existingUsers = db.getUsers();
		
		const validUpdatedUsers = updatedUsers.filter(user => user.telegramID != null && user.telegramID !== "");

		const existingById = new Map(existingUsers.map(user => [user.id, user]));

		const updatedById = new Map(validUpdatedUsers.map(user => [user.telegramID, user]));

		for (const updated of validUpdatedUsers) {
			const id = updated.telegramID;
			const existing = existingById.get(id);

			const normalizedUser = {
				id,
				username: updated.telegramnickname ?? updated.cn ?? "",
				name: updated.cn ?? ""
			};

			if (!existing) {
				await db.addUser(normalizedUser);
				continue;
			}

			const changes = {};

			if (existing.username !== normalizedUser.username) {
				changes.username = normalizedUser.username;
			}

			if (existing.name !== normalizedUser.name) {
				changes.name = normalizedUser.name;
			}

			if (Object.keys(changes).length > 0) {
				await db.updateUser(id, changes);
			}
		}

		for (const existing of existingUsers) {
			if (!updatedById.has(existing.id)) {
				await db.removeUser(existing.id);
			}
		}
	}
}