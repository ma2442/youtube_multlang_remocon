"use strict";
// 現在開いているタブページのurl取得
// youtube data api v3 で を取得するスクリプト

var main = async () => {
    let debug = true;
    let dlog = function (...args) {
        if (debug) console.log(...args);
    };

    // getElementByIdを指定回数リトライ Promiseを返す。
    let getElementByIdPromise = async (id, triesMax) => {
        if (triesMax == 0) return null;

        let elem = document.getElementById(id);
        dlog("id", id, "triesMax", triesMax, "%o", elem);
        if (elem) return elem;

        // 少し待ってリトライ
        await new Promise((ok) => setTimeout(ok, 50));
        return getElementByIdPromise(id, triesMax - 1);
    };

    let btnJaJp = await getElementByIdPromise("ja_jp", 30);
    let btnEnusUs = await getElementByIdPromise("enus_us", 30);
    let btnJa = await getElementByIdPromise("ja", 30);
    let btnJp = await getElementByIdPromise("jp", 30);
    let btnEnus = await getElementByIdPromise("enus", 30);
    let btnUs = await getElementByIdPromise("us", 30);
    let btnCh1 = await getElementByIdPromise("ch1", 30);
    let btnCh2 = await getElementByIdPromise("ch2", 30);
    let btnSetCh1 = await getElementByIdPromise("set_ch1", 30);
    let btnSetCh2 = await getElementByIdPromise("set_ch2", 30);
    let btnSetChDisp = await getElementByIdPromise("set_ch_disp", 30);

    let btnColorReset = () => {
        btnJa.style.backgroundColor = "";
        btnJp.style.backgroundColor = "";
        btnEnus.style.backgroundColor = "";
        btnUs.style.backgroundColor = "";
    };

    let setPink = async (e) => {
        e.style.backgroundColor = "pink";
    };

    /////////////////////////////////////////////////////////////////
    // キャッシュ関係の定義
    /////////////////////////////////////////////////////////////////
    let pref;
    let params;
    let hl = "ja";
    let gl = "JP";

    // cookie PREFを読み込んで params, hl, glに反映させる。
    let loadPref = async () => {
        pref = await chrome.cookies.get({
            url: "https://*.youtube.com/",
            name: "PREF",
        });
        params = new URLSearchParams(pref.value);
        hl = params.get("hl");
        gl = params.get("gl");
    };

    let loginInfo;
    let loadLoginInfo = async () => {
        loginInfo = await chrome.cookies.get({
            url: "https://*.youtube.com/",
            name: "LOGIN_INFO",
        });
    };

    // cookies.setに渡せないプロパティ削除, 必須プロパティ追加
    let formingForSet = (cookie) => {
        delete cookie.hostOnly;
        delete cookie.session;
        cookie.url = `https://*.${cookie.domain}/`;
        return cookie;
    };

    dlog(pref);

    ///////////////////////////////////////////////////////////////////////
    // 最初に設定読み込み、表示
    ///////////////////////////////////////////////////////////////////////

    // ahl: 言語(h???? language)
    // agl: 場所(global location)
    let setPref = async (ahl, agl) => {
        // 値設定
        hl = ahl || hl;
        gl = agl || gl;
        dlog(params.get("hl"), params.get("gl"));
        params.set("hl", hl);
        params.set("gl", gl);
        pref.value = params.toString();
        await chrome.cookies.set(formingForSet(pref));

        // 設定した値を取得して確認、表示反映
        await loadPref();
        btnColorReset();
        switch (hl) {
            case "ja":
                setPink(btnJa);
                break;
            case "en_US":
                setPink(btnEnus);
                break;
        }
        switch (gl) {
            case "JP":
                setPink(btnJp);
                break;
            case "US":
                setPink(btnUs);
                break;
        }
    };

    let { ch1 } = await chrome.storage.local.get("ch1");
    let { ch2 } = await chrome.storage.local.get("ch2");

    let setLoginInfo = async (val) => {
        loginInfo.value = val;
        await chrome.cookies.set(formingForSet(loginInfo));
    };

    // アクティブタブにリロード用スクリプトを埋め込む
    let tabReload = async () => {
        let tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });
        dlog(tabs);

        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ["scripting.js"],
        });
    };

    await loadPref();
    await setPref();
    await loadLoginInfo();

    //////////////////////////////////////////////////////////////////////
    // ボタンクリックイベント
    //////////////////////////////////////////////////////////////////////
    btnJaJp.addEventListener(
        "click",
        () => {
            setPref("ja", "JP");
        },
        true
    );

    btnEnusUs.addEventListener(
        "click",
        () => {
            setPref("en_US", "US");
        },
        true
    );
    btnJa.addEventListener(
        "click",
        () => {
            setPref("ja");
        },
        true
    );
    btnJp.addEventListener(
        "click",
        () => {
            setPref(undefined, "JP");
        },
        true
    );
    btnEnus.addEventListener(
        "click",
        () => {
            setPref("en_US");
        },
        true
    );
    btnUs.addEventListener(
        "click",
        () => {
            setPref(undefined, "US");
        },
        true
    );

    btnCh1.addEventListener(
        "click",
        async () => {
            ({ ch1 } = await chrome.storage.local.get("ch1"));
            dlog("ch1: ", ch1);
            await setLoginInfo(ch1);
            tabReload();
            window.close();
        },
        true
    );

    btnCh2.addEventListener(
        "click",
        async () => {
            ({ ch2 } = await chrome.storage.local.get("ch2"));
            dlog("ch2: ", ch2);
            await setLoginInfo(ch2);
            tabReload();
            window.close();
        },
        true
    );

    btnSetChDisp.addEventListener(
        "click",
        () => {
            let option = document.getElementById("option");
            option.hidden = !option.hidden;
            if (option.hidden) {
                btnSetChDisp.innerText = "数字ボタン設定を表示";
            } else {
                btnSetChDisp.innerText = "数字ボタン設定を隠す";
            }
        },
        true
    );

    btnSetCh1.addEventListener(
        "click",
        async () => {
            await loadLoginInfo();
            ch1 = loginInfo.value;
            await chrome.storage.local.set({ ch1: ch1 });
            ({ ch1 } = await chrome.storage.local.get("ch1"));
            dlog("ch1: ", ch1);
            alert("ボタン１に割り当てました。");
        },
        true
    );

    btnSetCh2.addEventListener(
        "click",
        async () => {
            await loadLoginInfo();
            ch2 = loginInfo.value;
            await chrome.storage.local.set({ ch2: ch2 });
            ({ ch2 } = await chrome.storage.local.get("ch2"));
            dlog("ch2: ", ch2);
            alert("ボタン２に割り当てました。");
        },
        true
    );

    //////////////////////////////////////////////////////////////////
    // イベントハンドラー、イベントリスナー
    //////////////////////////////////////////////////////////////////

    //////////////////////////////////////////////////////////////////
    // ユーティリティ部
    //////////////////////////////////////////////////////////////////

    //////////////////////////////////////////////////////////////////
    // 実行部
    //////////////////////////////////////////////////////////////////
};

window.onload = async () => {
    await main();
};
