const test = require("node:test");
const assert = require("node:assert/strict");

const {
  architectureTourContract,
  layers,
} = require("../../docs/javascripts/crystalline.js");

test("the architecture tour advances through every declared boundary", () => {
  assert.equal(architectureTourContract.nextLayer("author"), "prism");
  assert.equal(architectureTourContract.nextLayer("prism"), "substrait");
  assert.equal(architectureTourContract.nextLayer("substrait"), "session");
  assert.equal(architectureTourContract.nextLayer("session"), "adapter");
  assert.equal(architectureTourContract.nextLayer("adapter"), "author");
  assert.deepEqual(Object.keys(layers), ["author", "prism", "substrait", "session", "adapter"]);
});

test("architecture tab keys wrap and jump to stable boundaries", () => {
  assert.equal(architectureTourContract.keyboardIndex(0, "ArrowLeft", 5), 4);
  assert.equal(architectureTourContract.keyboardIndex(4, "ArrowRight", 5), 0);
  assert.equal(architectureTourContract.keyboardIndex(2, "Home", 5), 0);
  assert.equal(architectureTourContract.keyboardIndex(2, "End", 5), 4);
});

test("reduced-motion preference disables the automatic tour by default", () => {
  assert.equal(architectureTourContract.startsAutomatically(false), true);
  assert.equal(architectureTourContract.startsAutomatically(true), false);
});
