"use strict";

var done = false;

async function scriptingjs() {
    if (done) return;
    done = true;

    let debug = true;
    let dlog = function (...args) {
        if (debug) console.log(...args);
    };

    // timeoutmsまで非同期的にタスク完了を待つ関数
    let asyncWait = async (msg, timeoutms, task) => {
        dlog(msg, "start");
        for (let t = 0; t <= timeoutms; t += 200) {
            if (task()) {
                dlog(msg, ": COMPLETED");
                return true;
            }
            dlog(msg, ": in progress,", t, "msec");
            await new Promise((ok) => setTimeout(ok, 200));
        }
        dlog(msg, ": T I M E O U T !");
        alert(msg + ": T I M E O U T !");
    };

    let accountName = (await chrome.storage.local.get("ch")).ch;

    // 変更するChが指定されていなければリロードのみ。
    if (!accountName) {
        location.reload();
        return;
    }

    // 変更するChが指定されていれば、アカウント一覧を開いて当該Ch名をクリックする。

    // "アカウントを切り替える"ラベルを見つける関数
    const getSwitchAccountsLabel = () =>
        document.querySelector(
            "ytd-multi-page-menu-renderer" +
                " ytd-compact-link-renderer:nth-child(2)"
        );

    // 指定した名前のアカウントラベルを見つける関数
    const getAccountLabel = (name) => {
        const titles = [
            ...document.querySelectorAll("yt-formatted-string#channel-title"),
        ];
        dlog("getAccountLabel:", titles);
        return titles.filter(
            (dom) =>
                dom?.innerHTML == name ||
                dom?.querySelector("span")?.innerHTML == name
        )[0];
    };

    // "アカウントを切り替える"ラベルを見つける
    await asyncWait("find 'アカウントを切り替える'", 5000, () => {
        if (!getSwitchAccountsLabel()) {
            document.querySelector("#avatar-btn").click();
        }
        return getSwitchAccountsLabel();
    });

    // 指定した名前のアカウントラベルを見つける
    await asyncWait("find accout label: " + accountName, 5000, () => {
        if (!getAccountLabel(accountName)) {
            getSwitchAccountsLabel().click();
        }
        return getAccountLabel(accountName);
    });

    // 指定した名前のアカウントラベルをクリック
    getAccountLabel(accountName).click();
}

scriptingjs();
