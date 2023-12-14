import timer from 'node-schedule';
import { db } from './index.js';
import { sendNewWeeklyMessage } from './commands/weeklyMessage.js';
import { sendReminderToAllUsers } from './commands/users.js';

export default class Cron {
	constructor() {
		this.announcementJob = null;
		this.reminderJob = null;

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
}