"use strict";
// youtubeのCookieを取得、書き換えてCh,言語,場所の設定を操作するスクリプト

var main = async () => {
    //////////////////////////////////////////////////////////////////
    // ユーティリティ部
    //////////////////////////////////////////////////////////////////
    let debug = false;
    let dlog = function (...args) {
        if (debug) console.log(...args);
    };

    // ex: zip([a,b,c], [A,B,C], [0,1,2] )
    //    return [ [a,A,0], [b,B,1], [c,C,2] ]
    let zip = (...arrays) => {
        const len = Math.min(...arrays.map((ar) => ar.length));
        let zipped = [];
        for (let i = 0; i < len; i++) {
            zipped.push(arrays.map((ar) => ar[i]));
        }
        return zipped;
    };

    // ex: [a,b,c].zip( [A,B,C], [0,1,2] )
    //    return [ [a,A,0], [b,B,1], [c,C,2] ]
    Array.prototype.zip = function (...arrays) {
        return zip(this, ...arrays);
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

    // SelectタグにOption要素を追加するメソッド
    HTMLElement.prototype.addOption = function (val, label) {
        let opt = document.createElement("option");
        opt.value = val;
        opt.label = label;
        this.appendChild(opt);
    };

    // batch情報(ch, lang, location のlabel, valueキーを持つ連想配列)と
    // label、ボタンidxを持たせたボタンタグを追加するメソッド
    HTMLElement.prototype.addButton = function (batch, label, idx) {
        let btn = document.createElement("button");
        btn.batch = batch;
        btn.innerHTML = label;
        btn.idx = idx;

        // ボタン動作追加
        btn.addEventListener(
            "click",
            async (e) => {
                // ワンタッチボタン削除モードの挙動
                if (delBatchCheck.checked) {
                    if (
                        window.confirm(
                            `「${e.target.innerHTML}」を削除しますか？`
                        )
                    ) {
                        let { batches } = await chrome.storage.local.get(
                            "batches"
                        );
                        batches ??= [];
                        batches.splice(e.target.idx, 1);
                        await chrome.storage.local.set({ batches: batches });
                        await updateBatchBtns();
                    }
                    return;
                }

                // ワンタッチボタン通常モードの挙動
                // Ch Cookie変更
                // location Cookie, lang Cookie変更
                if (btn.batch.ch.value) await setLoginInfo(btn.batch.ch.value);
                gl = btn.batch.location || gl;
                hl = btn.batch.lang || hl;
                setPref(hl, gl);

                // 更新
                reloadActiveTab();
                window.close();
                return;
            },
            true
        );
        this.appendChild(btn);
    };
    // ユーティリティ部 終了
    ////////////////////////////////////////////////////////////////////////////

    let locationSelect = await getElementByIdPromise("location_select", 30);
    let langSelect = await getElementByIdPromise("lang_select", 30);
    let chSelect = await getElementByIdPromise("ch_select", 30);

    // 場所・言語削除ボタン
    let btnLocationDel = await getElementByIdPromise("location_del", 30);
    let btnLangDel = await getElementByIdPromise("lang_del", 30);

    // チャンネル追加・削除ボタン
    let btnChDel = await getElementByIdPromise("ch_del", 30);
    let btnChAdd = await getElementByIdPromise("ch_add", 30);

    // 設定反映ボタン
    let btnReload = await getElementByIdPromise("reload", 30);

    // 「ワンタッチボタンに登録」ボタン
    let btnAddBatch = await getElementByIdPromise("add_batch", 30);

    // 設定選択セクションの編集モードチェックボックス
    let editCheck = await getElementByIdPromise("edit_check", 30);

    // ワンタッチボタン群
    let batchBtns = await getElementByIdPromise("batch_btns", 30);

    // ワンタッチボタン削除モードチェックボックス
    let delBatchCheck = await getElementByIdPromise("del_batch_check", 30);

    // データ移行セクションのタグ群
    let migrationMenu = await getElementByIdPromise("migration_menu", 30);
    let btnClearAllData = await getElementByIdPromise("clear_all_data", 30);
    let btnCopyAllData = await getElementByIdPromise("copy_all_data", 30);
    let textAllData = await getElementByIdPromise("all_data", 30);
    let btnImportAllData = await getElementByIdPromise("import_all_data", 30);

    // データ移行メニュー表示チェックボックス
    let dispMigrationMenuCheck = await getElementByIdPromise(
        "disp_migration_menu_check",
        30
    );

    // 選択項目の現在値識別用チェックマーク
    const checkmark = "✅";

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
            KR: "Korea",
            en: "English (US)",
            US: "United States",
            DZ: "Algeria",
            AR: "Argentina",
            AU: "Australia",
        };
        return dispList[str] ?? str;
    };

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
    };

    let { ch1, ch2 } = await chrome.storage.local.get(["ch1", "ch2"]);

    let setLoginInfo = async (val) => {
        loginInfo.value = val;
        await chrome.cookies.set(formingForSet(loginInfo));
    };

    // アクティブタブにリロード用スクリプトを埋め込む
    let reloadActiveTab = async () => {
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

    // デバッグ用表示
    let dinput;
    if (debug) {
        (function createDebugInfo() {
            // 要素生成して追加
            dinput = document.createElement("input");
            dinput.id = "debug";
            document.body.appendChild(dinput);
            loadPref();
            dinput.value = "言語 " + hl + "   国 " + gl;
        })();
    }

    loadPref();

    let loadList = async (key) => {
        let list = await chrome.storage.local.get(`${key}`);
        list = list[key];
        dlog("list: ", list);
        return list ?? [];
    };

    let delFromList = async (listKey, i) => {
        let list = await loadList(listKey);
        list.splice(i, 1);
        let keyVals = {};
        keyVals[listKey] = list;
        await chrome.storage.local.set(keyVals);
        await updateSelectList(listKey);
        dlog("list after delete: ", list);
    };

    // ストレージ内の指定したリストに値を追加する関数
    let storeValueToList = async (listKey, value) => {
        let list = await loadList(listKey);

        if (value && !list.includes(value)) {
            dlog(value);
            list.push(value);
            let keyVals = {};
            keyVals[listKey] = list;
            await chrome.storage.local.set(keyVals);
        }
        return list;
    };

    // listKeyからSelectタグとCurValを紐づけ
    let curSetting = (key) => {
        if (key == "locations") {
            return {
                selectList: locationSelect,
                curVal: gl,
            };
        }
        if (key == "langs") {
            return {
                selectList: langSelect,
                curVal: hl,
            };
        }
    };

    // SelectタグにList反映
    let updateSelectList = async (listKey) => {
        // どのリストに対しての操作か？
        let { selectList, curVal } = curSetting(listKey);

        let list = await loadList(listKey);

        // 表示するリストのOptionタグを作成
        selectList.innerHTML = "";
        for (const e of list) {
            dlog(selectList instanceof HTMLElement);
            selectList.addOption(e, dispName(e));
        }

        // 現在の設定値にチェックマークをつける。
        let curIdx = list.indexOf(curVal);
        dlog("listKey, curVal, curIdx: ", listKey, curVal, curIdx);
        // selectList.selectedIndex = curIdx;
        if (curIdx == -1) return;

        selectList.options[curIdx].label =
            checkmark + selectList.options[curIdx].label;
    };

    // ストレージの指定したリストに現在の設定値を追加する関数
    let addCurValToListAndUpdateDisp = async (listKey) => {
        dlog("listKey: ", listKey);
        dlog("curSetting(listKey): ", curSetting(listKey));
        let list = await storeValueToList(listKey, curSetting(listKey).curVal);
        await updateSelectList(listKey);
    };

    // Chリスト更新
    let updateChList = async () => {
        let selectList = chSelect;
        // chListは value, label をもつ。
        let chList = await loadList("chs");

        // 表示するリストのOptionタグを作成
        selectList.innerHTML = "";
        for (const e of chList) {
            dlog(selectList instanceof HTMLElement);
            selectList.addOption(e.value, e.label);
        }

        // 現在の設定値にチェックマークをつける。
        await loadLoginInfo();
        let curVal = loginInfo.value;
        let curIdx = chList.map((ch) => ch.value).indexOf(curVal);
        dlog("curVal, curIdx: ", curVal, curIdx);
        if (curIdx == -1) return;
        selectList.options[curIdx].label =
            checkmark + selectList.options[curIdx].label;
    };

    // ボタンラベルに成形
    let genBatchBtnLabel = (batch) =>
        [batch.ch.label, dispName(batch.lang), dispName(batch.location)].join(
            " / "
        );

    // ボタンリスト更新
    let updateBatchBtns = async () => {
        let { batches } = await chrome.storage.local.get("batches");
        batches ??= [];
        batchBtns.innerHTML = "";
        batches.map((e, i) => {
            dlog("batch: ", e);
            batchBtns.addButton(e, genBatchBtnLabel(e), i);
        });
    };

    // init location and langs SelectLists
    await addCurValToListAndUpdateDisp("locations");
    await addCurValToListAndUpdateDisp("langs");

    await updateChList();
    await updateBatchBtns();

    //////////////////////////////////////////////////////////////////////
    // ボタンクリックイベント
    //////////////////////////////////////////////////////////////////////
    btnLocationDel.addEventListener(
        "click",
        async () => {
            let i = locationSelect.selectedIndex;
            if (i != -1) await delFromList("locations", i);
        },
        true
    );
    btnLangDel.addEventListener(
        "click",
        async () => {
            let i = langSelect.selectedIndex;
            if (i != -1) await delFromList("langs", i);
        },
        true
    );

    // Ch リストから削除する
    btnChDel.addEventListener(
        "click",
        async () => {
            let i = chSelect.selectedIndex;
            if (i == -1) {
                return;
            }
            let chList = await loadList("chs");
            chList.splice(i, 1);
            await chrome.storage.local.set({ chs: chList });
            await updateChList();
        },
        true
    );

    // Ch リストに追加する
    btnChAdd.addEventListener(
        "click",
        async () => {
            // ChのCookie取得
            let chList = await loadList("chs");
            await loadLoginInfo();
            let ch = { label: "", value: loginInfo.value };

            // 重複チェック
            const sameChs = chList.filter((e) => e.value == loginInfo.value);
            if (sameChs[0]) {
                alert(
                    `このChは「${sameChs[0].label}」という名前で登録済みです。`
                );
                return;
            }

            // Ch表示名決定、登録、リスト更新
            ch.label = window.prompt("Chの名前を決めてください。", "");
            if (!ch.label) return;
            if (chList.some((e) => e.label == ch.label)) {
                alert(`「${ch.label}」という名前はすでに使われています。`);
                return;
            }
            chList.push(ch);
            await chrome.storage.local.set({ chs: chList });
            await updateChList();
        },
        true
    );

    // 設定反映ボタン
    btnReload.addEventListener(
        "click",
        async () => {
            // Ch Cookie変更
            {
                let i = chSelect.selectedIndex;
                dlog("chSelect.selectedIndex: ", i);
                if (i != -1) await setLoginInfo(chSelect.options[i].value);
            }
            // location Cookie, lang Cookie変更
            {
                let i = locationSelect.selectedIndex;
                dlog("locationSelect.selectedIndex: ", i);
                if (i != -1) gl = locationSelect.options[i].value;
            }
            {
                let i = langSelect.selectedIndex;
                dlog("langSelect.selectedIndex: ", i);
                if (i != -1) hl = langSelect.options[i].value;
            }
            setPref(hl, gl);

            // 更新
            reloadActiveTab();
            window.close();
            return;
        },
        true
    );

    // 設定をワンタッチボタンとして追加
    btnAddBatch.addEventListener(
        "click",
        async () => {
            //Ch 選択項目取得
            let batch = {};
            {
                let i = chSelect.selectedIndex;
                dlog("chSelect.selectedIndex: ", i);
                if (i != -1) {
                    const list = await loadList("chs");
                    batch.ch = list[i];
                }
            }
            // location, lang 選択項目取得
            {
                let i = locationSelect.selectedIndex;
                dlog("locationSelect.selectedIndex: ", i);
                if (i != -1) {
                    let list = await loadList("locations");
                    batch.location = list[i];
                }
            }
            {
                let i = langSelect.selectedIndex;
                dlog("langSelect.selectedIndex: ", i);
                if (i != -1) {
                    let list = await loadList("langs");
                    batch.lang = list[i];
                }
            }
            if (!batch.ch || !batch.location || !batch.lang) {
                alert(
                    "Ch, 言語, 場所のいずれかが選択されていないため、" +
                        "ボタン追加できません。\n"
                );
                return;
            }

            // バッチボタンリスト取得、追加、更新
            let { batches } = await chrome.storage.local.get("batches");
            batches ??= [];
            dlog("batches: ", batches);
            dlog("batch: ", batch);
            const btnLabel = genBatchBtnLabel(batch);
            dlog("btnLabel: ", btnLabel);
            if (batches.map((b) => genBatchBtnLabel(b)).includes(btnLabel)) {
                alert(`「 ${btnLabel} 」 は既に登録されています。`);
                return;
            }
            batches.push(batch);
            await chrome.storage.local.set({ batches: batches });

            await updateBatchBtns();
            return;
        },
        true
    );

    // 編集モードチェックボックスの状態変化
    editCheck.addEventListener("change", (e) =>
        document
            .querySelectorAll(".del, #add_batch")
            .forEach(
                (item) =>
                    (item.style.display = e.target.checked ? "inline" : "none")
            )
    );

    // 全データをクリップボードへコピーボタン
    btnCopyAllData.addEventListener(
        "click",
        async () => {
            const data = await chrome.storage.local.get();
            dlog("alldata: ", data);
            textAllData.value = JSON.stringify(data);
            navigator.clipboard.writeText(JSON.stringify(data));
            alert("コピーしました！");
            return;
        },
        true
    );

    // テキストエリアからデータをインポート
    btnImportAllData.addEventListener(
        "click",
        async () => {
            if (
                !window.confirm(
                    "全データをテキストより読み込みます。" + "実行しますか？"
                )
            )
                return;
            const data = JSON.parse(textAllData.value);
            await chrome.storage.local.set(data);
            window.close();
            return;
        },
        true
    );

    // 全データ消去
    btnClearAllData.addEventListener(
        "click",
        async () => {
            if (!window.confirm("全データを消去します。本当によろしいですか？"))
                return;
            await chrome.storage.local.clear();
            window.close();
        },
        true
    );

    // データ移行メニューを表示 チェックボックスの状態変化
    dispMigrationMenuCheck.addEventListener(
        "change",
        (e) =>
            (migrationMenu.style.display = e.target.checked ? "block" : "none")
    );

    //////////////////////////////////////////////////////////////////
    // イベントハンドラー、イベントリスナー
    //////////////////////////////////////////////////////////////////

    //////////////////////////////////////////////////////////////////
    // 実行部
    //////////////////////////////////////////////////////////////////
};

window.onload = async () => {
    await main();
};
