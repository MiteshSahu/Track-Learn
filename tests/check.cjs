// Static application: syntax/build validation without adding a bundler.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(base,'index.html'),'utf8');
for (const [i,match] of [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].entries()) new vm.Script(match[1],{filename:'index-inline-'+i});
for (const name of ['amazon-prep.js','amazon-prep-data.js','supabase-config.js']) new vm.Script(fs.readFileSync(path.join(base,name),'utf8'),{filename:name});
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(base,'amazon-prep-data.js'),'utf8'),sandbox);
const d=sandbox.window.AMAZON_PREP_DATA;
assert.equal(d.questions.length,133);assert.equal(new Set(d.questions.map(q=>q.num)).size,133);
assert.equal(d.questions.filter(q=>q.priority==='MUST_DO').length,57);
assert.equal(d.hld.length,10);assert.equal(d.lld.length,12);assert.equal(d.stories.length,15);assert.equal(d.projects.length,2);assert.equal(d.mocks.length,5);
for(const q of d.questions)assert.match(q.url,/^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/$/);
for(const name of ['amazon-prep.js','amazon-prep-data.js','amazon-prep.css'])assert.ok(html.includes(name));
console.log('PASS: all script syntax, asset references, 133 unique seeds, priorities, design/story/project/mock counts');

assert.equal(d.questions.filter(q=>q.priority==='GOOD_TO_DO').length,39);

assert.equal(d.questions.filter(q=>q.recentExperience).length,12);
assert.equal(d.recentTopics.patterns.length,6);
