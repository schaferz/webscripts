/**
 * Jira keresés végrehajtása.
 *
 * @param jql Jira lekérdezés
 * @param startAt eltolás a lapozáshoz
 * @param maxResults maximális eredmények száma
 * @return Promise
 */
function postJiraSearch(jql, startAt, maxResults) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: window.location.origin + '/rest/api/latest/search',
            type: 'POST',
            data: JSON.stringify({jql, startAt, maxResults, fields: ['key', 'worklog']}),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            success: function (response) {
                resolve(response);
            },
            error: function (xhr, status, error) {
                reject({xhr, status, error});
            }
        });
    });
}

/**
 * Jira issue alapján worklog lekérdezése
 *
 * @param issue a Jira issue
 * @return Promise
 */
function getJiraWorklog(issue) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: `${window.location.origin}/rest/api/latest/issue/${issue}/worklog`,
            type: 'GET',
            success: function (response) {
                resolve(response);
            },
            error: function (xhr, status, error) {
                reject({xhr, status, error});
            }
        });
    });
}

/**
 * @param date dátum
 * @return {string} dátum szövegként
 */
function convertDateToString(date) {
    return date.toLocaleString('en-us', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2');
}

/**
 * @param fromDate tól
 * @param toDate ig
 * @return dátum lista szöveges formában (pl.: 2021-10-10, 2021-10-11)
 */
function createDayList(fromDate, toDate) {
    let date = fromDate;
    const dates = [];

    // date list
    while (date <= toDate) {
        dates.push(convertDateToString(date));

        date = new Date(date.getTime() + 86400000);
    }

    return dates;
}

/**
 * Beviteli mezőhöz dátum választás beállítása.
 *
 * @param inputField a beviteli mező, melybe a dátum kerül
 * @param button gomb mely indukálja a dátum választó megjelenését
 */
function setupCalendar(inputField, button) {
    Calendar.setup({
        firstDay: 1,
        inputField: inputField,
        button: button,
        align: 'Br',
        singleClick: true,
        showsTime: true,
        useISO8601WeekNumbers: false,
        ifFormat: '%Y.%m.%d'
    });
}

/**
 * Kereső vagy találati (táblázat) tartalom mutatása.
 *
 * @param type megjelenítendő típus: search, content, load
 */
function showContent(type) {
    if ('search' === type) {
        $('#worklog-dialog-form').removeClass('hidden');
        $('#search-worklog').removeClass('hidden');

        $('#worklog-table').addClass('hidden');
        $('#back-to-worklog-search').addClass('hidden');
        $('#worklog-loading').removeClass('hidden').addClass('hidden');
    } else if ('content' === type) {
        $('#worklog-dialog-form').addClass('hidden');
        $('#search-worklog').addClass('hidden');

        $('#worklog-table').removeClass('hidden');
        $('#back-to-worklog-search').removeClass('hidden');
        $('#worklog-loading').removeClass('hidden').addClass('hidden');
    } else if ('load' === type) {
        $('#worklog-dialog-form').addClass('hidden');
        $('#search-worklog').addClass('hidden');
        $('#worklog-loading').removeClass('hidden');
    }
}

/**
 * Felhasználó picker függvény (Jira kódjából származik).
 *
 * @param e paraméterek
 * @return function ami átadható a JQuery eseménynek
 */
function createUserPickerPopupTrigger(e) {
    const urlBase = e.urlBase;
    const formName = e.formName;
    const fieldName = e.fieldName;
    const multiSelect = e.multiSelect;
    const fieldConfigId = e.fieldConfigId;
    const triggerEvent = e.triggerEvent;
    let l = e.projectIds;

    return function (e) {
        let s, f = urlBase;

        if (e.preventDefault(),
            f += '/secure/popups/UserPickerBrowser.jspa',
            f += '?formName=' + formName,
            f += '&multiSelect=' + Boolean(multiSelect),
            f += '&decorator=popup',
            f += '&element=' + fieldName,
        fieldConfigId && (f += '&fieldConfigId=' + fieldConfigId),
            l) {
            l = [].concat(l);
            let p = !0, u = !1, d = void 0;
            try {
                for (let g, m = l[Symbol.iterator](); !(p = (g = m.next()).done); p = !0) {
                    f += '&projectId=' + g.value
                }
            } catch (e) {
                u = !0, d = e
            } finally {
                try {
                    !p && m.return && m.return()
                } finally {
                    if (u) {
                        throw d;
                    }
                }
            }
        }
        triggerEvent && (f += '&triggerEvent=' + triggerEvent),
            s = window.open(f, 'UserPicker', 'status=yes,resizable=yes,top=100,left=100,width=800,height=850,scrollbars=yes'),
            s.opener = self,
            s.focus()
    }
}

/**
 * @param sec_num másodperc
 * @return {string} másodperc szöveges formában hh:mm:ss
 */
function toDuration(sec_num) {
    if (!sec_num) {
        return '';
    }

    let hours = Math.floor(sec_num / 3600);
    let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    let seconds = sec_num - (hours * 3600) - (minutes * 60);
    let hasSeconds = seconds > 0;

    if (hours < 10) {
        hours = "0" + hours;
    }
    if (minutes < 10) {
        minutes = "0" + minutes;
    }
    if (seconds < 10) {
        seconds = "0" + seconds;
    }

    return hasSeconds ? hours + ':' + minutes + ':' + seconds : hours + ':' + minutes;
}

/**
 * Worklog adatok megjelenítése a táblázatban.
 *
 * @param dates dátumok (napok egy tömbben)
 * @param displayNames felhasználónév - megjelenített név map
 * @param worklogData worklog adatok
 */
function updateWorklogTable(dates, displayNames, worklogData) {
    const usernames = Object.keys(displayNames).sort((a, b) => displayNames[a].localeCompare(displayNames[b], 'hu'));
    const headRow = $('#worklog-table thead tr');
    const body = $('#worklog-table tbody');

    // clean
    headRow.empty();
    body.empty();

    // head
    headRow.append('<th>Nap</th>');
    usernames.forEach(name => headRow.append(`<th>${displayNames[name]}</th>`));

    // body - day
    for (const date of dates) {
        const tr = $(`<tr><td>${date.replaceAll('-', '.')}</td></tr>`);

        for (const username of usernames) {
            const seconds = worklogData[date][username];

            tr.append(`<td>${toDuration(seconds)}</td>`);
        }

        body.append(tr);
    }

    // body - avg
    const avgTr = $('<tr style="font-weight: bold;"><td>Átlag</td></tr>');

    for (const username of usernames) {
        const seconds = worklogData.avg[username];

        avgTr.append(`<td>${toDuration(seconds)}</td>`);
    }

    body.append(avgTr);

    // body - percent
    const percentTr = $('<tr style="font-weight: bold;"><td>Százalék</td></tr>');

    for (const username of usernames) {
        const value = Math.round(worklogData.percent[username]);

        percentTr.append(`<td>${value}%</td>`);
    }

    body.append(percentTr);
}

/**
 * @param userDisplayNames user - display name object
 * @param worklogs Jira worklog-ok
 * @param fromDate dátum - tól
 * @param toDate dátum ig
 * @return {object} olyan objektum struktúra mely egyes napokra tartalmazza felhasználónként a worklog-ot
 */
function createDayUserWorklog(userDisplayNames, worklogs, fromDate, toDate) {
    const result = {count: {}, sum: {}, avg: {}, percent: {}};
    const dates = createDayList(fromDate, toDate);
    const usernames = Object.keys(userDisplayNames).sort();

    // default 0
    usernames.forEach(u => {
        result.count[u] = 0;
        result.sum[u] = 0;
        result.avg[u] = 0;
        result.percent[u] = 0;
    });

    // day and user worklog
    for (const d of dates) {
        result[d] = {};
        const dayWorklogs = worklogs.filter(w => d === w.started.substring(0, 10));
        const daySum = dayWorklogs.reduce((acc, w) => acc + w.timeSpentSeconds, 0) || 0;

        if (daySum === 0) {
            console.log(`${d} nap kihagyva, nincs worklog rögzítve!`);
            continue;
        }

        for (const username of usernames) {
            const dayUserWorklogs = dayWorklogs.filter(w => w.author.name === username);
            result[d][username] = dayUserWorklogs.reduce((acc, w) => acc + w.timeSpentSeconds, 0) || 0;
            result.count[username] += 1;

            if (result[d][username]) {
                result.sum[username] += result[d][username];
            }
        }
    }

    // avg and percent
    for (const username of usernames) {
        if (result.count[username] > 0) {
            result.avg[username] = result.sum[username] / result.count[username];
            result.percent[username] = result.avg[username] / 60.0 / 60.0 / 8.0 * 100.0;
        } else {
            result.percent[username] = 0;
            result.avg[username] = 0;
        }
    }

    return result;
}

/**
 * Issue-k és azok alapján worklog bejegyzések lekérdezése és feldolgozása.
 *
 * @param users felhasználók
 * @param dateFrom dátum - tól
 * @param dateTo dátum ig
 * @return Promise
 */
async function searchJiraIssueWorklog(users, dateFrom, dateTo) {
    const from = dateFrom.replaceAll('.', '-');
    const to = dateTo.replaceAll('.', '-');
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const dates = createDayList(fromDate, toDate);
    const userList = users.split(',').map(u => u.trim());
    const jql = `worklogAuthor in (${users}) and worklogDate >= ${from} and worklogDate <= ${to}`;
    const maxResults = 400;
    const search = await postJiraSearch(jql, 0, maxResults);
    const {total} = search;
    let issues = [...search.issues];

    // paginate
    if (total > maxResults) {
        let startAt = maxResults;

        while (total > startAt) {
            const resp = await postJiraSearch(jql, startAt, maxResults);

            issues = [...issues, ...resp.issues];
            startAt += maxResults;
        }
    }

    // collect worklog items and user - display name map
    const displayNames = {};
    const worklogs = [];

    for (const issue of issues) {
        const {worklog} = issue.fields;
        let worklogList = [];

        if (worklog.total > worklog.maxResults) {
            const resp = await getJiraWorklog(issue.key);

            worklogList = resp.worklogs;
        } else {
            worklogList = worklog.worklogs;
        }

        for (const w of worklogList) {
            const {name, displayName} = w.author;
            const {started} = w;

            if (!userList.includes(name)) {
                continue;
            }

            const startedDay = started.substring(0, 10);

            if (!dates.includes(startedDay)) {
                continue;
            }

            worklogs.push(w);
            displayNames[name] = displayName;
        }
    }

    // create day - user - worklog object map
    const result = createDayUserWorklog(displayNames, worklogs, fromDate, toDate);

    updateWorklogTable(dates, displayNames, result);
    console.log(result);

    return true;
}

/** Worklog keresés indítása. */
function searchWorklog() {
    const users = AJS.$('#worklog-users').val();
    const dateFrom = $('#date-from').val();
    const dateTo = $('#date-to').val();
    let wasError = false;

    $('#worklog-dialog-form .error').removeClass('hidden').addClass('hidden');

    if (!users || users.trim().length === 0) {
        $('#worklog-users-error').removeClass('hidden');
        wasError = true;
    }

    if (!dateFrom) {
        $('#date-from-error').removeClass('hidden');
        wasError = true;
    }

    if (!dateTo) {
        $('#date-to-error').removeClass('hidden');
        wasError = true;
    }

    if (!wasError) {
        showContent('load');
        searchJiraIssueWorklog(users, dateFrom, dateTo).then(r => {
            if (r) {
                localStorage.setItem('jira-worklog-users', users);
                localStorage.setItem('jira-worklog-dateFrom', dateFrom);
                localStorage.setItem('jira-worklog-dateTo', dateTo);
                showContent('content');
            }
        });
    }
}

/** Dialógus bezárása. */
function closeDialog() {
    // remove blanket
    $('.aui-blanket-worklog')
        .off('click.worklog')
        .remove();

    // remove dialog
    $('#worklog-dialog').remove();
}

/** Dialógus összeállítása és megjelenítése. */
function showDialog() {
    // append worklog dialog
    $('body').append(`
        <section id="worklog-dialog"
            class="aui-dialog2 aui-layer jira-dialog2 jira-dialog-core aui-dialog2-large jira-dialog-open jira-dialog-content-ready"
            role="dialog" aria-labelledby="jira-dialog2__heading" style="z-index: 3000;width: 80vw;" open=""
            data-aui-focus="false" data-aui-blanketed="true" tabindex="-1">
            <header class="aui-dialog2-header jira-dialog-core-heading">
                <h2 id="jira-dialog2__heading" title="Worklog search">
                    Worklog keresés
                </h2>
            </header>
            <div class="aui-dialog2-content jira-dialog-core-content">
                <form id="worklog-dialog-form" name="worklog-jiraform" action="#" class="aui">
                    <div class="field-group">
                        <label for="worklog-users">
                            Felhasználók
                            <span class="visually-hidden">Required</span>
                            <span class="aui-icon icon-required" aria-hidden="true"></span>
                        </label>                
                        <input class="text long-field" style="max-width: 60%;" id="worklog-users" name="worklog-users" 
                            type="text" value="" data-qe-no-aria-label="true">
                        <a id="worklog-users-trigger" class="popup-trigger" title="Felhasználók kiválasztása" href="#">
                            <span class="icon-default aui-icon aui-icon-small aui-iconfont-admin-roles"></span>
                        </a>
                        <div class="description" id="users-description">
                            Felhasználók melyekre a worklog-ot lekérdezzük, vesszővel elválasztva a felhasználónevek.
                        </div>
                        <div class="error hidden" data-field="worklog-users" id="worklog-users-error">
                            Felhasználó kitöltése kötelező!
                        </div>
                    </div>
                    <div class="field-group aui-field-datepicker">
                        <label for="date-from">
                            Dátum - tól
                            <span class="visually-hidden">Required</span>
                            <span class="aui-icon icon-required" aria-hidden="true"></span>
                        </label>
                        <input class="text medium-field" id="date-from" name="date-from" type="text" value="">
                        <a href="#" id="date-from-trigger" title="Válassz dátumot">
                            <span class="icon-default aui-icon aui-icon-small aui-iconfont-calendar">Válassz dátumot</span>
                        </a>
                        <div class="description" id="date-from-description">Worklog keresés ettől a dátumtól kezdve.</div>
                        <div class="error hidden" data-field="date-from" id="date-from-error">
                            Dátum - tól kitöltése kötelező!
                        </div>
                    </div>
                    <div class="field-group aui-field-datepicker">
                        <label for="date-to">
                            Dátum - ig
                            <span class="visually-hidden">Required</span>
                            <span class="aui-icon icon-required" aria-hidden="true"></span>
                        </label>
                        <input class="text medium-field" id="date-to" name="date-to" type="text" value="">
                        <a href="#" id="date-to-trigger" title="Válassz dátumot">
                            <span class="icon-default aui-icon aui-icon-small aui-iconfont-calendar">Válassz dátumot</span>
                        </a>
                        <div class="description" id="date-to-description">Worklog keresés eddig a dátumig.</div>
                        <div class="error hidden" data-field="date-to" id="date-to-error">
                            Dátum - ig kitöltése kötelező!
                        </div>
                    </div>
                </form>
                <table id="worklog-table" class="issue-table hidden">
                    <thead>
                        <tr class="rowHeader"></tr>
                    </thead>
                    <tbody>
                    
                    </tbody>
                </table>
                <div id="worklog-loading" class="hidden">
                    <p>Keresés...</p>
                </div>
            </div>
            <footer class="aui-dialog2-footer">
                <div class="buttons-container form-footer">
                    <div class="buttons" style="display: flex; justify-content: flex-end;">
                        <span class="throbber"></span>
                        <button id="search-worklog" class="aui-button aui-button-primary search-button" type="button">Keresés</button>
                        <button id="back-to-worklog-search" class="aui-button aui-button-primary search-button hidden" type="button">Vissza</button>
                        <button id="cancel-worklog" type="button" class="aui-button aui-button-link">Mégse</button>
                    </div>
                </div>
            </footer>
        </section>
        <div aria-hidden="true" class="aui-blanket aui-blanket-worklog" tabindex="0" style="z-index: 2980;"></div>
    `);

    // restore values
    AJS.$('#worklog-users').val(localStorage.getItem('jira-worklog-users'));
    $('#date-from').val(localStorage.getItem('jira-worklog-dateFrom'));
    $('#date-to').val(localStorage.getItem('jira-worklog-dateTo'));

    // setup fields
    $('#worklog-users-trigger').on('click', createUserPickerPopupTrigger({
        formName: 'worklog-jiraform',
        fieldName: 'worklog-users',
        urlBase: window.location.origin,
        triggerEvent: 'userpicker:onPopUpSelection',
        multiSelect: true
    }));
    setupCalendar('date-from', 'date-from-trigger');
    setupCalendar('date-to', 'date-to-trigger');

    // setup buttons
    $('#search-worklog').on('click', searchWorklog);
    $('#cancel-worklog').on('click', closeDialog);
    $('#back-to-worklog-search').on('click', () => showContent('search'));

    // gray background blanket
    $('.aui-blanket-worklog')
        .on('click.worklog', closeDialog)
        .removeAttr('hidden');
}

/** Menübe gomb elhelyezése, amivel a dialógus megnyitható. */
function addNavLink() {
    const header = $('.aui-header-primary .aui-nav');

    header.append(`
        <li id="worklog-menu">
            <span class="aui-button aui-button-primary aui-style">Worklog</span>
        </li>
    `);

    $('#worklog-menu').on('click', showDialog);
}

(function () {
    'use strict';

    addNavLink();
})();
