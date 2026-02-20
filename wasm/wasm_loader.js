// ============================================================
// wasm_loader.js - Wasm Content Script 래퍼
// ============================================================
// wasm-pack --target web 이 생성한 naver_news_filter.js는
// ES Module 형식(export/import.meta.url)이라 content_script에서
// 직접 사용 불가. 이 파일이 필요한 함수를 전역(__NNC_WASM)으로 노출.
// ============================================================

(function () {
    'use strict';

    // ── 원본 glue JS에서 필요한 내부 변수/함수를 인라인으로 재구현 ──
    // (import.meta.url 및 export 구문 없이)

    let wasm;
    let wasmModule;

    const heap = new Array(128).fill(undefined);
    heap.push(undefined, null, true, false);
    let heap_next = heap.length;

    function addHeapObject(obj) {
        if (heap_next === heap.length) heap.push(heap.length + 1);
        const idx = heap_next;
        heap_next = heap[idx];
        heap[idx] = obj;
        return idx;
    }

    function getObject(idx) { return heap[idx]; }

    function dropObject(idx) {
        if (idx < 132) return;
        heap[idx] = heap_next;
        heap_next = idx;
    }

    function takeObject(idx) {
        const ret = getObject(idx);
        dropObject(idx);
        return ret;
    }

    let cachedDataViewMemory0 = null;
    function getDataViewMemory0() {
        if (
            cachedDataViewMemory0 === null ||
            cachedDataViewMemory0.buffer.detached === true ||
            (cachedDataViewMemory0.buffer.detached === undefined &&
                cachedDataViewMemory0.buffer !== wasm.memory.buffer)
        ) {
            cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
        }
        return cachedDataViewMemory0;
    }

    let cachedUint8ArrayMemory0 = null;
    function getUint8ArrayMemory0() {
        if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
            cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
        }
        return cachedUint8ArrayMemory0;
    }

    let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();

    function getStringFromWasm0(ptr, len) {
        ptr = ptr >>> 0;
        return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr >>> 0, ptr + len >>> 0));
    }

    const cachedTextEncoder = new TextEncoder();
    if (!('encodeInto' in cachedTextEncoder)) {
        cachedTextEncoder.encodeInto = function (arg, view) {
            const buf = cachedTextEncoder.encode(arg);
            view.set(buf);
            return { read: arg.length, written: buf.length };
        };
    }

    let WASM_VECTOR_LEN = 0;
    function passStringToWasm0(arg, malloc, realloc) {
        if (realloc === undefined) {
            const buf = cachedTextEncoder.encode(arg);
            const ptr = malloc(buf.length, 1) >>> 0;
            getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
            WASM_VECTOR_LEN = buf.length;
            return ptr;
        }
        let len = arg.length;
        let ptr = malloc(len, 1) >>> 0;
        const mem = getUint8ArrayMemory0();
        let offset = 0;
        for (; offset < len; offset++) {
            const code = arg.charCodeAt(offset);
            if (code > 0x7F) break;
            mem[ptr + offset] = code;
        }
        if (offset !== len) {
            if (offset !== 0) arg = arg.slice(offset);
            ptr = realloc(ptr, len, (len = offset + arg.length * 3), 1) >>> 0;
            const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
            const ret = cachedTextEncoder.encodeInto(arg, view);
            offset += ret.written;
            ptr = realloc(ptr, len, offset, 1) >>> 0;
        }
        WASM_VECTOR_LEN = offset;
        return ptr;
    }

    // ── import 객체 ──
    function getImports() {
        return {
            './naver_news_filter_bg.js': {
                __wbg___wbindgen_throw_be289d5034ed271b: function (arg0, arg1) {
                    throw new Error(getStringFromWasm0(arg0, arg1));
                },
                __wbindgen_cast_0000000000000001: function (arg0, arg1) {
                    return addHeapObject(getStringFromWasm0(arg0, arg1));
                },
            },
        };
    }

    function finalizeInit(instance, module) {
        wasm = instance.exports;
        wasmModule = module;
        cachedDataViewMemory0 = null;
        cachedUint8ArrayMemory0 = null;
        return wasm;
    }

    // ── NewsFilter 클래스 (export 없이 전역 노출) ──
    const NewsFilterFinalization =
        typeof FinalizationRegistry === 'undefined'
            ? { register: () => { }, unregister: () => { } }
            : new FinalizationRegistry((ptr) => wasm.__wbg_newsfilter_free(ptr >>> 0, 1));

    class NewsFilterImpl {
        __destroy_into_raw() {
            const ptr = this.__wbg_ptr;
            this.__wbg_ptr = 0;
            NewsFilterFinalization.unregister(this);
            return ptr;
        }
        free() {
            const ptr = this.__destroy_into_raw();
            wasm.__wbg_newsfilter_free(ptr, 0);
        }
        constructor(config_json) {
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                const ptr0 = passStringToWasm0(config_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                const len0 = WASM_VECTOR_LEN;
                wasm.newsfilter_new(retptr, ptr0, len0);
                const r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                const r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                const r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
                if (r2) throw takeObject(r1);
                this.__wbg_ptr = r0 >>> 0;
                NewsFilterFinalization.register(this, this.__wbg_ptr, this);
                return this;
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
            }
        }
        check_article(source, title, content) {
            let deferred4_0, deferred4_1;
            try {
                const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
                const ptr0 = passStringToWasm0(source, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                const len0 = WASM_VECTOR_LEN;
                const ptr1 = passStringToWasm0(title, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                const len1 = WASM_VECTOR_LEN;
                const ptr2 = passStringToWasm0(content, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                const len2 = WASM_VECTOR_LEN;
                wasm.newsfilter_check_article(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
                const r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
                const r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
                deferred4_0 = r0; deferred4_1 = r1;
                return getStringFromWasm0(r0, r1);
            } finally {
                wasm.__wbindgen_add_to_stack_pointer(16);
                wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
            }
        }
        should_block(source, title, content) {
            const ptr0 = passStringToWasm0(source, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(title, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            const ptr2 = passStringToWasm0(content, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len2 = WASM_VECTOR_LEN;
            return wasm.newsfilter_should_block(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2) !== 0;
        }
        get_blocked_sources_count() { return wasm.newsfilter_get_blocked_sources_count(this.__wbg_ptr) >>> 0; }
        get_blocked_keywords_count() { return wasm.newsfilter_get_blocked_keywords_count(this.__wbg_ptr) >>> 0; }
        free() {
            const ptr = this.__destroy_into_raw();
            wasm.__wbg_newsfilter_free(ptr, 0);
        }
    }

    // ── Wasm 초기화 함수 (fetch → WebAssembly.instantiateStreaming) ──
    // new Function / eval / import.meta 일절 사용하지 않음 → CSP 안전
    async function nncInitWasm(wasmBinaryUrl) {
        if (wasm !== undefined) return true; // 이미 초기화됨

        try {
            const imports = getImports();
            let result;

            if (typeof WebAssembly.instantiateStreaming === 'function') {
                try {
                    result = await WebAssembly.instantiateStreaming(fetch(wasmBinaryUrl), imports);
                } catch (e) {
                    // MIME 타입 문제 등으로 실패 시 arrayBuffer 방식으로 폴백
                    console.warn('[NNC-Loader] instantiateStreaming 실패, arrayBuffer 방식으로 재시도:', e.message);
                    const bytes = await fetch(wasmBinaryUrl).then(r => r.arrayBuffer());
                    result = await WebAssembly.instantiate(bytes, imports);
                }
            } else {
                const bytes = await fetch(wasmBinaryUrl).then(r => r.arrayBuffer());
                result = await WebAssembly.instantiate(bytes, imports);
            }

            finalizeInit(result.instance, result.module);
            return true;
        } catch (e) {
            console.error('[NNC-Loader] Wasm 초기화 실패:', e.message);
            return false;
        }
    }

    // ── 전역 네임스페이스로 노출 ──
    // content.js에서 window.__NNC_WASM.init() / new window.__NNC_WASM.NewsFilter() 로 사용
    window.__NNC_WASM = {
        NewsFilter: NewsFilterImpl,
        init: nncInitWasm,
        isReady: () => wasm !== undefined,
    };

})();
