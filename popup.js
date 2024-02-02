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

    let btnPair1 = await getElementByIdPromise("pair1", 30);
    let btnPair2 = await getElementByIdPromise("pair2", 30);
    let btnHl1 = await getElementByIdPromise("lang1", 30);
    let btnGl1 = await getElementByIdPromise("location1", 30);
    let btnHl2 = await getElementByIdPromise("lang2", 30);
    let btnGl2 = await getElementByIdPromise("location2", 30);
    let btnCh1 = await getElementByIdPromise("ch1", 30);
    let btnCh2 = await getElementByIdPromise("ch2", 30);
    let btnSetPair1 = await getElementByIdPromise("set_pair1", 30);
    let btnSetPair2 = await getElementByIdPromise("set_pair2", 30);
    let btnSetCh1 = await getElementByIdPromise("set_ch1", 30);
    let btnSetCh2 = await getElementByIdPromise("set_ch2", 30);
    let btnDispOption = await getElementByIdPromise("disp_option", 30);

    let hl1, hl2, gl1, gl2;

    let btnColorReset = () => {
        btnHl1.style.backgroundColor = "";
        btnGl1.style.backgroundColor = "";
        btnHl2.style.backgroundColor = "";
        btnGl2.style.backgroundColor = "";
    };

    let updateBtnColor = () => {
        btnColorReset();
        dlog("hl: ", hl, ", ", hl1, hl2);
        dlog("gl: ", gl, ", ", gl1, gl2);
        if (hl == hl1) setPink(btnHl1);
        if (hl == hl2) setPink(btnHl2);
        if (gl == gl1) setPink(btnGl1);
        if (gl == gl2) setPink(btnGl2);
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

    // 言語・場所表示名
    let dispName = (str) => {
        const dispList = {
            ja: "日本語",
            JP: "日本",
            en: "English (US)",
            US: "United States",
        };
        return dispList[str] ?? str;
    };

    let setBtnLabels = (hl1, hl2, gl1, gl2) => {
        let dhl1 = dispName(hl1);
        let dhl2 = dispName(hl2);
        let dgl1 = dispName(gl1);
        let dgl2 = dispName(gl2);
        btnPair1.innerHTML = `${dhl1}</br>+ ${dgl1}`;
        btnPair2.innerHTML = `${dhl2}</br>+ ${dgl2}`;
        btnHl1.innerHTML = `${dhl1}`;
        btnHl2.innerHTML = `${dhl2}`;
        btnGl1.innerHTML = `${dgl1}`;
        btnGl2.innerHTML = `${dgl2}`;
    };

    let loadPairs = async () => {
        ({ hl1, hl2, gl1, gl2 } = await chrome.storage.local.get([
            "hl1",
            "hl2",
            "gl1",
            "gl2",
        ]));
        hl1 ??= "ja";
        hl2 ??= "en";
        gl1 ??= "JP";
        gl2 ??= "US";
        setBtnLabels(hl1, hl2, gl1, gl2);
    };

    let setPair1 = async (ahl, agl) => {
        await chrome.storage.local.set({ hl1: ahl, gl1: agl });
        await loadPairs();
        updateBtnColor();
    };

    let setPair2 = async (ahl, agl) => {
        await chrome.storage.local.set({ hl2: ahl, gl2: agl });
        await loadPairs();
        updateBtnColor();
    };

    await loadPairs();
    updateBtnColor();

    // cookie PREF の 言語 hl, 場所 gl を変更
    // ahl: 言語(h???? language)
    // agl: 場所(global location)
    let setPref = async (ahl, agl) => {
        // 値設定
        hl = ahl ?? hl;
        gl = agl ?? gl;
        dlog(params.get("hl"), params.get("gl"));
        params.set("hl", hl);
        params.set("gl", gl);
        pref.value = params.toString();
        await chrome.cookies.set(formingForSet(pref));

        // 設定した値を取得して確認、表示反映
        await loadPref();
        updateBtnColor();
    };

    let { ch1, ch2 } = await chrome.storage.local.get(["ch1", "ch2"]);

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
    btnPair1.addEventListener("click", () => setPref(hl1, gl1), true);
    btnPair2.addEventListener("click", () => setPref(hl2, gl2), true);
    btnHl1.addEventListener("click", () => setPref(hl1), true);
    btnGl1.addEventListener("click", () => setPref(undefined, gl1), true);
    btnHl2.addEventListener("click", () => setPref(hl2), true);
    btnGl2.addEventListener("click", () => setPref(undefined, gl2), true);

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

    btnDispOption.addEventListener(
        "click",
        () => {
            let option = document.getElementById("option");
            option.hidden = !option.hidden;
            if (option.hidden) {
                btnDispOption.innerText = "ボタン割り当て設定を表示";
            } else {
                btnDispOption.innerText = "ボタン割り当て設定を隠す";
            }
        },
        true
    );

    btnSetPair1.addEventListener(
        "click",
        async () => {
            await loadPref();
            await setPair1(hl, gl);
            alert(
                `左ボタンに${dispName(hl)} + ${dispName(gl)} を割り当てました。`
            );
        },
        true
    );

    btnSetPair2.addEventListener(
        "click",
        async () => {
            await loadPref();
            await setPair2(hl, gl);
            alert(
                `右ボタンに${dispName(hl)} + ${dispName(gl)} を割り当てました。`
            );
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
