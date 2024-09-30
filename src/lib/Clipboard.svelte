<!-- 
Copyright 2019 https://github.com/meloalright

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

-->

<script>
  import { onMount, tick, createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  export let text;

  let textarea;

  async function copy() {
    textarea.select();
    document.execCommand("Copy");
    await tick();
    textarea.blur();
    dispatch("copy");
  }
</script>

<style>
  textarea {
    left: 0;
    bottom: 0;
    margin: 0;
    padding: 0;
    opacity: 0;
    width: 1px;
    height: 1px;
    border: none;
    display: block;
    position: absolute;
  }
</style>

<slot {copy} />
<textarea bind:this={textarea} value={text} />
