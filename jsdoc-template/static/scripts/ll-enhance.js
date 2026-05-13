/**
 * ll-enhance.js — Library Loot JSDoc UX enhancements
 *
 * Adapted from the mcl-central template by Luckey Logic.
 *
 * The UI elements (inputs, buttons, TOC container) are stamped directly into
 * the HTML by layout.tmpl and source.tmpl, so this script only wires up
 * interactivity — no DOM creation, no timing issues.
 *
 * Features:
 *   1. Sidebar nav filter  — type to filter the Contents file list
 *   2. In-file TOC         — auto-detected symbols listed under "IN THIS FILE"
 *   3. In-file text search — search + ↑/↓ navigation over source lines
 */

(function () {
  'use strict';

  // ── 0. Mobile nav toggle ──────────────────────────────────────────────────

  var navToggle = document.getElementById('ll-nav-toggle');
  var navInnerEl = document.getElementById('ll-nav-inner');
  if (navToggle && navInnerEl) {
    navToggle.addEventListener('click', function () {
      var isOpen = navInnerEl.classList.contains('ll-nav-open');
      navInnerEl.classList.toggle('ll-nav-open', !isOpen);
      navToggle.setAttribute('aria-expanded', String(!isOpen));
    });
  }

  // ── 1. Sidebar nav filter ──────────────────────────────────────────────────

  var navInput = document.getElementById('ll-nav-search');
  if (navInput) {
    var navInner = document.getElementById('ll-nav-inner') || document.querySelector('.ll-nav-inner');

    navInput.addEventListener('input', function () {
      var q = this.value.trim().toLowerCase();
      if (!navInner) return;

      navInner.querySelectorAll('h3').forEach(function (h3) {
        var ul = h3.nextElementSibling;
        if (!ul || ul.tagName !== 'UL') return;

        var visible = 0;
        ul.querySelectorAll('li').forEach(function (li) {
          var match = !q || li.textContent.toLowerCase().indexOf(q) !== -1;
          li.style.display = match ? '' : 'none';
          if (match) visible++;
        });

        var show = !q || visible > 0;
        h3.style.display = show ? '' : 'none';
        ul.style.display  = show ? '' : 'none';
      });
    });
  }

  // ── 2. Footer build info ──────────────────────────────────────────────────
  // Runs on EVERY page (not just source pages). Replaces the placeholder
  // build stamp with the live SHA + date written by
  // scripts/write-docs-build-info.js, and appends a "Source on GitHub" link.
  // Placed before the source-page early-return below so the homepage gets
  // the same footer treatment.
  if (window.LL_BUILD) {
    var stamp = document.querySelector('.ll-build-stamp');
    if (stamp) {
      stamp.innerHTML =
        'Build ' + window.LL_BUILD.buildDate + ' UTC · ' +
        '<a href="' + window.LL_BUILD.repo + '/commit/' + window.LL_BUILD.sha + '" ' +
        'target="_blank" rel="noopener">' + window.LL_BUILD.sha + '</a>' +
        ' (' + window.LL_BUILD.branch + ')';
    }
    var footer = document.querySelector('.ll-footer');
    if (footer && !footer.querySelector('.ll-footer-github')) {
      var sep = document.createElement('span');
      sep.className = 'll-footer-sep';
      sep.textContent = '·';
      var link = document.createElement('a');
      link.className = 'll-footer-github';
      link.href      = window.LL_BUILD.repo;
      link.target    = '_blank';
      link.rel       = 'noopener';
      link.textContent = 'Source on GitHub';
      footer.appendChild(sep);
      footer.appendChild(link);
    }
  }

  // ── 3 & 4. Source-page features (TOC + search) ────────────────────────────
  // These only run if we're on a source page (source.tmpl injects the search bar).

  var searchBar = document.getElementById('ll-source-search-bar');
  if (!searchBar) return; // Not a source page — nothing more to do.

  // Give prettify + linenumber.js one tick to finish restructuring the DOM.
  setTimeout(function () {

    var ol        = document.querySelector('ol.linenums');
    var lines     = ol ? Array.prototype.slice.call(ol.querySelectorAll('li')) : [];
    var tocPanel  = document.getElementById('ll-source-toc');
    var searchInput   = document.getElementById('ll-source-search-input');
    var counter       = document.getElementById('ll-source-search-counter');
    var prevBtn       = document.getElementById('ll-source-prev-btn');
    var nextBtn       = document.getElementById('ll-source-next-btn');

    // ── 2. Build in-file TOC ───────────────────────────────────────────────

    if (tocPanel && lines.length) {
      var toc = [];

      lines.forEach(function (li, i) {
        var lineNum = i + 1;
        var text    = li.textContent.trim();

        // Section divider comments: // ── NAME ──
        var sec = text.match(/\/\/\s*[─━═\-]{2,}\s*([A-Z][A-Za-z &/\-]+?)\s*[─━═\-]{2,}/);
        if (sec) { toc.push({ lineNum: lineNum, label: sec[1].trim(), type: 'section' }); return; }

        // export default function/class
        var expDef = text.match(/export\s+default\s+(?:async\s+)?(?:function\s*\*?\s*|class\s+)(\w+)/);
        if (expDef) { toc.push({ lineNum: lineNum, label: expDef[1], type: 'export' }); return; }

        // export function / export async function
        var expFn = text.match(/^export\s+(?:async\s+)?function\s*\*?\s*(\w+)/);
        if (expFn) { toc.push({ lineNum: lineNum, label: expFn[1], type: 'function' }); return; }

        // export const / export let
        var expConst = text.match(/^export\s+(?:const|let)\s+(\w+)/);
        if (expConst) { toc.push({ lineNum: lineNum, label: expConst[1], type: 'const' }); return; }

        // standalone function declarations
        var fnDecl = text.match(/^(?:async\s+)?function\s*\*?\s*(\w+)\s*\(/);
        if (fnDecl) { toc.push({ lineNum: lineNum, label: fnDecl[1], type: 'function' }); return; }

        // class declarations
        var classDecl = text.match(/^(?:export\s+)?(?:default\s+)?class\s+(\w+)/);
        if (classDecl) { toc.push({ lineNum: lineNum, label: classDecl[1], type: 'class' }); return; }

        // exports.name = ... (Cloud Functions / CommonJS style)
        var cjsExport = text.match(/^exports\.(\w+)\s*=/);
        if (cjsExport) { toc.push({ lineNum: lineNum, label: cjsExport[1], type: 'export' }); return; }
      });

      if (toc.length > 0) {
        var heading = document.createElement('p');
        heading.className = 'll-source-toc-heading';
        heading.textContent = 'IN THIS FILE';
        tocPanel.appendChild(heading);

        var list = document.createElement('ul');
        list.className = 'll-source-toc-list';

        toc.forEach(function (item) {
          var li = document.createElement('li');
          li.className = 'll-toc-item ll-toc-' + item.type;
          var a = document.createElement('a');
          a.href = '#line' + item.lineNum;
          a.textContent = item.label;
          a.addEventListener('click', function (e) {
            e.preventDefault();
            var target = document.getElementById('line' + item.lineNum);
            if (!target) return;
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('ll-line-pulse');
            setTimeout(function () { target.classList.remove('ll-line-pulse'); }, 1200);
            history.replaceState(null, '', '#line' + item.lineNum);
          });
          li.appendChild(a);
          list.appendChild(li);
        });

        tocPanel.appendChild(list);
        tocPanel.style.display = '';
      }
    }

    // ── 3. In-file text search ─────────────────────────────────────────────

    if (!searchInput || !lines.length) return;

    var matches = [];
    var current = -1;

    function clearHighlights() {
      lines.forEach(function (li) {
        li.classList.remove('ll-match', 'll-match-active');
      });
      matches = [];
      current = -1;
      if (counter) counter.textContent = '';
    }

    function goTo(idx) {
      if (!matches.length) return;
      if (current >= 0 && current < matches.length) {
        matches[current].classList.remove('ll-match-active');
      }
      current = ((idx % matches.length) + matches.length) % matches.length;
      matches[current].classList.add('ll-match-active');
      matches[current].scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (counter) counter.textContent = (current + 1) + ' / ' + matches.length;
    }

    function doSearch(q) {
      clearHighlights();
      if (!q) return;
      var lower = q.toLowerCase();
      lines.forEach(function (li) {
        if (li.textContent.toLowerCase().indexOf(lower) !== -1) {
          li.classList.add('ll-match');
          matches.push(li);
        }
      });
      if (matches.length > 0) {
        goTo(0);
      } else {
        if (counter) counter.textContent = 'No matches';
      }
    }

    searchInput.addEventListener('input', function () { doSearch(this.value.trim()); });
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); goTo(e.shiftKey ? current - 1 : current + 1); }
      if (e.key === 'Escape') { this.value = ''; clearHighlights(); }
    });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(current + 1); });
    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(current - 1); });

  }, 50); // 50ms — enough for prettify to finish even on large files

}());
