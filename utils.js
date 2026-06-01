import dayjs from "dayjs";
import objectSupport from 'dayjs/plugin/objectSupport.js';

dayjs.extend(objectSupport)

export function isJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

export function userToLink(user) {
	let userlink = user.userId; // emergency backup, should never happen
	if (user != undefined) {
		if (user.name != undefined) {
			if (user.username != undefined) userlink = '<a href="https://t.me/' + user.username + '">' + user.name+ '</a>';
			else userlink = user.name;
		} else if (user.username != undefined) userlink = '@' + user.username;
	}
	return userlink;
}

export function dateStringToDayJs(str) {
	if (str.match(/^\d+$/)) {
		let now = dayjs();
		let month = now.month();
		let day = Number(str);
		if (day < now.date()) month++;
		return dayjs({year: now.year(), month, day});
	}
	return dayjs(str);
}