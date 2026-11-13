// Flags: --expose-internals
'use strict';

// The buffer bindings must not read the view before converting arguments
// whose valueOf() can detach or shrink the underlying ArrayBuffer.

require('../common');
const assert = require('assert');
const { internalBinding } = require('internal/test/binding');

const binding = internalBinding('buffer');

function createView() {
  const arrayBuffer = new ArrayBuffer(64, { maxByteLength: 128 });
  return { arrayBuffer, view: new Uint8Array(arrayBuffer) };
}

function detachingIndex(arrayBuffer, value) {
  return {
    valueOf() {
      arrayBuffer.transfer();
      return value;
    },
  };
}

function shrinkingIndex(arrayBuffer, value) {
  return {
    valueOf() {
      arrayBuffer.resize(8);
      return value;
    },
  };
}

{
  const { arrayBuffer } = createView();
  const buffer = Buffer.from(arrayBuffer);
  assert.throws(() => buffer.fill(detachingIndex(arrayBuffer, 0x41)),
                { code: 'ERR_BUFFER_OUT_OF_BOUNDS' });
}

const sliceMethods = [
  'asciiSlice',
  'base64Slice',
  'base64urlSlice',
  'latin1Slice',
  'hexSlice',
  'ucs2Slice',
  'utf8Slice',
];

for (const method of sliceMethods) {
  const slice = Buffer.prototype[method];
  {
    const { arrayBuffer, view } = createView();
    const start = detachingIndex(arrayBuffer, 0);
    assert.strictEqual(slice.call(view, start, 64), '');
  }
  {
    const { arrayBuffer, view } = createView();
    const end = detachingIndex(arrayBuffer, 64);
    assert.strictEqual(slice.call(view, 0, end), '');
  }
  {
    const { arrayBuffer, view } = createView();
    const end = shrinkingIndex(arrayBuffer, 64);
    assert.throws(() => slice.call(view, 0, end), { code: 'ERR_OUT_OF_RANGE' });
  }
}

const writeMethods = [
  binding.base64Write,
  binding.base64urlWrite,
  binding.hexWrite,
  binding.ucs2Write,
  binding.asciiWriteStatic,
  binding.latin1WriteStatic,
  binding.utf8WriteStatic,
];

for (const write of writeMethods) {
  {
    const { arrayBuffer, view } = createView();
    const offset = detachingIndex(arrayBuffer, 0);
    assert.strictEqual(write(view, 'AAAA', offset, 64), 0);
  }
  {
    const { arrayBuffer, view } = createView();
    const length = detachingIndex(arrayBuffer, 64);
    assert.strictEqual(write(view, 'AAAA', 0, length), 0);
  }
  {
    const { arrayBuffer, view } = createView();
    const length = shrinkingIndex(arrayBuffer, 64);
    assert.strictEqual(write(view, 'AAAA'.repeat(64), 0, length), 8);
  }
}
