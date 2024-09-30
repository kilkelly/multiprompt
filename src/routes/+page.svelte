<script>
    import { onMount } from 'svelte'
    import { fade } from 'svelte/transition'
    import markdownit from 'markdown-it'
    import GithubSlugger from 'github-slugger'
    import { db } from "$lib/db"
    import Copy from '$lib/Copy.svelte'        
    import Download from '$lib/Download.svelte'        
    import {
        MODEL_TYPE_TEXT,
        MODEL_TYPE_IMAGE,
        DELIMITER
    } from '$lib/common'
    import {
        storeModelType,
        storeNumberOfModels,
        storeAPIKey
    } from '$lib/stores'    

    // -----

    const DEFAULT_REPLY_TEXT = 'Chat reply will appear here'
    const MODEL_REPLIES_DEFAULT =  {
        reply: DEFAULT_REPLY_TEXT,
        nanoCost: 0,
        model: '',
        copyText: '',
        error: false
    }
    const MODEL_NUMBER_INCREASE = 'MODEL_NUMBER_INCREASE'
    const MODEL_NUMBER_DECREASE = 'MODEL_NUMBER_DECREASE'
    const LOADING = '[[loading]]'    
    const md = markdownit()    
    
    let apiKey = ''
    let apiKeyError = ''
    
    let prompt = ''
    const slugger = new GithubSlugger()
    $: promptSlugged = slugger.slug(prompt)

    let textModels = []
    let imageModels = []
    let nanoBalance = 0
    let modelReplies = []
    for (let i = 0; i < $storeNumberOfModels; i++) {
        modelReplies.push({})
    }
    
    initiateModelReplies()

    let chatInProgress = false

    let showHistory = false
    let prompts = []
    const HISTORY_PROMPT_CUTOFF = 1000
    const HISTORY_MAX_SIZE = 100

    // -----

    async function models () {
        let res = await fetch('https://nano-gpt.com/api/models')

        let models = (await res.json())

        textModels = Object.values(models.models.text).sort(function (x, y) {
            if (x.name < y.name) { return -1 }
            if (x.name > y.name) { return 1 }
            return 0;            
        })
        .filter(textModel => {
            return textModel.visible
        })          

        imageModels = Object.values(models.models.image).reduce((acc, imageModel) => {
            let imageModel_ = Object.assign({}, imageModel)
            let costResolutions = Object.keys(imageModel.cost)

            costResolutions.forEach(costResolution => {
                acc.push(
                    Object.assign(
                        {},
                        imageModel_,
                        {
                            name: imageModel.name + ' (' + costResolution + ')',
                            costEstimate: imageModel.cost[costResolution],
                            resolution: costResolution
                        }
                    )
                )
            })

            return acc
        }, []).sort(function (x, y) {
            if (x.cost < y.name) { return -1 }
            if (x.name > y.name) { return 1 }
            return 0;            
        })
        
    }

    // -----

    async function balance () {
        let res = await fetch('/balance', {
            method: 'post',
            body: JSON.stringify({ apiKey: $storeAPIKey })
        })
        nanoBalance = (await res.text())
    }
    
    // -----

    async function chat () {
        
        chatInProgress = true

        modelReplies = modelReplies.map(modelReply => {
            modelReply.reply = LOADING
            modelReply.nanoCost = 0
            modelReply.resolution = ''
            modelReply.error = false
            return modelReply
        })        

        let modelsToSend = []
        
        modelReplies.forEach((modelReply, i) => {          
            modelsToSend[i] = modelReply.model
        })

        let res = await fetch('/', {
            method: 'post',
            body: JSON.stringify({
                apiKey: $storeAPIKey,
                prompt,
                models: modelsToSend,
                modelType: $storeModelType
            })
        })

        try {
            let { replies } = (await res.json())

            replies.forEach(({reply, nanoCost, modelSnapshot, error}, i) => {
                modelReplies[i] = Object.assign(modelReplies[i], {reply, nanoCost, modelSnapshot, error})
            })
   
            let savableModelReplies = modelReplies.filter(x => {return x.nanoCost !== 0 && !x.error})

            if (savableModelReplies.length) {
                try {
                    await db.prompts.add({
                        timestamp: Date.now(),
                        prompt,
                        modelType: $storeModelType,
                        modelReplies: savableModelReplies
                    })
                } catch (error) {
                    console.error('Failed to save to history', error)
                }

                balance()
            }

        } catch (error) {
            console.error(error)
        }

        chatInProgress = false

    }    

    // -----

    function modelNumberChange(action) {
        switch (action) {
            case MODEL_NUMBER_INCREASE:
                if (modelReplies.length < 10) {
                    modelReplies = [...modelReplies, Object.assign({key: (modelReplies.length + 1)}, MODEL_REPLIES_DEFAULT)]
                    $storeNumberOfModels++
                }
                break
            case MODEL_NUMBER_DECREASE:
                if (modelReplies.length > 1) {
                    modelReplies.pop()
                    modelReplies = modelReplies
                    $storeNumberOfModels--
                }
                break
        }
    }

    // -----

    function initiateModelReplies () {
        modelReplies.map((m, i) => {
            return Object.assign(m, {key: i} ,MODEL_REPLIES_DEFAULT)
        })
    }

    // -----

    function changeModelType (modelType_) {
        $storeModelType = modelType_
        initiateModelReplies()
    }    

    // -----

    function saveAPIKey () {
        const UUIDRegex = new RegExp('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}');
        if (UUIDRegex.test(apiKey)) {
            apiKeyError = ''
            $storeAPIKey = apiKey
            init()
        } else {
            apiKeyError = 'Please enter a valid NanoGPT API key'
        }
    }
    
    // -----

    function clearAPIKey () {
        clearHistory()
        $storeAPIKey = ''
        apiKey=''
        apiKeyError=''
        prompt=''
        initiateModelReplies()
    }    

    // -----

    async function showHistory_() {
        showHistory = true
        prompts =
            await db.prompts
                    .reverse()
                    .toArray()
    }

    // -----

    async function clearHistory () {
        await db.prompts.clear()
        showHistory_()
    }        

    // -----

    async function init() {
        if ($storeAPIKey) {
            balance()
            models()
            showHistory = false
            await db.prompts.reverse().offset(HISTORY_MAX_SIZE).delete()
        }        
    }

    onMount(_ => {     
        init()
    })

</script>

{#if $storeAPIKey}
    <header>
        <div id="balance">
            Current Nano balance: <strong>Ӿ{nanoBalance}</strong>&nbsp;&nbsp; 
            <a href="https://nano-gpt.com/wallet" target="_blank" rel="noopener">Top-up balance</a> |            
            <button id="show-history" class="link underline" on:click={_ => {if (showHistory) {showHistory = false} else {showHistory_()}}}>{showHistory ? 'Close' : 'Show'} prompt history</button>            
        </div>
    </header>
{/if}

{#if !$storeAPIKey}
    <main id="splash-screen">
        <h1>MultiPrompt</h1>
        <div>
            <form on:submit={_ => saveAPIKey()}>
                <!-- svelte-ignore a11y-autofocus -->
                <input
                    id="api-key"
                    type="text"
                    bind:value={apiKey}
                    placeholder="Enter your NanoGPT API key"    
                    autocomplete="off"    
                    autofocus             
                />
                <button type="submit">Save</button>
            </form>
        </div>
        <div class="error-message">{apiKeyError}</div>
    </main>
{:else if showHistory}
    <main id="history">
        <h2>Prompt History (last {HISTORY_MAX_SIZE} prompts)</h2>
        <div>            
            <button class="link underline" on:click={_ => {showHistory = false}}>Close prompt history</button> | <button class="link caution underline" on:click={_ => {if (confirm('Are you sure you want to clear your prompt history?')) {clearHistory()}}}>Clear prompt history</button>
        </div>

        <div id="history-grid">
            <span class="history-table-header">Date</span>
            <span class="history-table-header">Type</span>
            <span class="history-table-header help" title="Number of models prompted">#</span>
            <span class="history-table-header">Prompt</span>            
            {#each prompts as prompt_ (prompt_.id)}
            <span>{new Date(prompt_.timestamp).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })}</span>
            <span>{prompt_.modelType === MODEL_TYPE_TEXT ? 'Chat' : 'Image'}</span>
            <span>{prompt_.modelReplies.length}</span>            
            <button class="link" on:click={_ => {prompt = prompt_.prompt;modelReplies=prompt_.modelReplies;$storeNumberOfModels=prompt_.modelReplies.length;$storeModelType=prompt_.modelType;scrollTo(0,0);showHistory = false}}>{prompt_.prompt.substring(0, HISTORY_PROMPT_CUTOFF)}{prompt_.prompt.length > HISTORY_PROMPT_CUTOFF ? '...' : ''}</button>
        {/each}            
        </div>

        <div>            
            <button class="link underline" on:click={_ => {showHistory = false}}>Close prompt history</button> | <button class="link caution underline" on:click={_ => {if (confirm('Are you sure you want to clear your prompt history?')) {clearHistory()}}}>Clear prompt history</button>
        </div>
    
    </main>
{:else}
    <main>    
        <h1>MultiPrompt</h1>    
        <div id="model-type-choose">
            <input name="model-type" id="model-type-text" type="radio" on:click={_ => {changeModelType(MODEL_TYPE_TEXT)} } disabled={chatInProgress} checked={$storeModelType === MODEL_TYPE_TEXT}/>
            <label for="model-type-text">Chat</label>

            <input name="model-type" id="model-type-image" type="radio" on:click={_ => {changeModelType(MODEL_TYPE_IMAGE)} } disabled={chatInProgress} checked={$storeModelType === MODEL_TYPE_IMAGE}/>
            <label for="model-type-image">Image</label>        
        </div>

        <textarea bind:value={prompt} rows="4" cols="100" placeholder={$storeModelType === MODEL_TYPE_IMAGE ? 'Describe your image' : 'Enter your chat'} readonly={chatInProgress}></textarea>

        <button id="chat-button" on:click={chat} disabled={prompt === '' || chatInProgress}>
            {
                $storeModelType === MODEL_TYPE_IMAGE 
                    ? chatInProgress
                        ? 'Generating...'
                        : 'Generate'
                    : chatInProgress
                        ? 'Thinking...'
                        : 'Chat'
            }
        </button>

        <div id="number-of-models">
            Number of Models ({modelReplies.length})
            <button on:click={_ => modelNumberChange(MODEL_NUMBER_DECREASE)} disabled={chatInProgress}>-</button>        
            <button on:click={_ => modelNumberChange(MODEL_NUMBER_INCREASE)} disabled={chatInProgress}>+</button>
        </div>    

        {#key $storeModelType}

            <div id="multi">
                {#each modelReplies as modelReply (modelReply.key)}
                    <div class="panel" id="panel{modelReply.key}" in:fade={{ delay: 50 }}>
                        <select id="select{modelReply.key}" bind:value={modelReply.model} disabled={chatInProgress}>
                            <option value="">Select model</option>
                            {#if $storeModelType === MODEL_TYPE_IMAGE}
                                {#each imageModels as model}
                                    <option value={model.model + DELIMITER + model.name + DELIMITER + model.resolution}>{model.name} (cost estimate: Ӿ{model.costEstimate})</option>
                                {/each}                    
                            {:else}
                                {#each textModels as model}
                                    <option value={model.model + DELIMITER + model.name}>{model.name} (cost estimate: Ӿ{model.costEstimate})</option>
                                {/each}
                            {/if}
                        </select>
                        <div>
                            {#if (modelReply.error)}
                            <p class="reply-error">
                                {modelReply.error}
                            </p>
                            {:else if !(modelReply.reply === DEFAULT_REPLY_TEXT) && modelReply.reply}
                                <p class="reply">
                                {#if (modelReply.reply === LOADING)}
                                    <img id="chatting" src="/chatting.gif" alt="Chatting"/>
                                {:else}
                                    {#if $storeModelType === MODEL_TYPE_IMAGE}
                                        <Download 
                                            reply={modelReply.reply}
                                            {promptSlugged}
                                        />
                                        <a href="data:image/png;base64,{modelReply.reply}" download={promptSlugged + ".png"} title={prompt}>
                                            <img class="image" src="data:image/png;base64,{modelReply.reply}" alt={prompt}/>
                                        </a>
                                        <Download 
                                            reply={modelReply.reply}
                                            {promptSlugged}
                                        />
                                    {:else}                            
                                        <Copy reply={modelReply.reply} />
                                        {@html md.render(modelReply.reply) || ''}
                                        <Copy reply={modelReply.reply} />
                                    {/if}
                                {/if}
                                </p>
                            {/if}
                        </div>
                        {#if modelReply.nanoCost > 0}
                            <div>
                                Cost: Ӿ<span>{modelReply.nanoCost}</span>
                            </div>
                            <div>
                                Model: <span>{modelReply.modelSnapshot.split(DELIMITER)[1]}</span>
                            </div>        
                        {/if}
                    </div>
                {/each}
            </div>    
        {/key}
    </main>
{/if}
<section id="about">
    <details>
        <summary>What is MultiPrompt?</summary>
        <p>MultiPrompt allows you to send a prompt to multiple LLMs / text models / image models simultaneously.</p>
    </details>    
    <details>
        <summary>How do I use it?</summary>
        <p>You will need an <a href="https://nano-gpt.com/api" target="_blank" rel="noopener">API key</a> for NanoGPT, a service that enables pay-per-prompt usage of different text and image models. You will need to enter this API key before using MultiPrompt. You will also need to top-up your <a href="https://nano-gpt.com/wallet" target="_blank" rel="noopener">NanoGPT wallet</a> using any of their available payment options.</p>
    </details>    
    <details>
        <summary>How does it work?</summary>
        <p>This tool forwards your prompts to the NanoGPT service and gathers the results for display in a side-by-side format.</p>
    </details>    
    <details>
        <summary>What about privacy</summary>
        <p>As this tool is running locally on your machine, your prompts and responses will only ever be seen by your web browser and the NanoGPT service. This is the same as if you used <a href="https://nano-gpt.com/" target="_blank" rel="noopener">NanoGPT</a> directly.</p>        
    </details>    
</section>
{#if ($storeAPIKey)}
    <div id="clear-api-key">        
        <button class="link caution underline" on:click={_ => {if (confirm('Are you sure you want to clear your NanoGPT API key?')) {clearAPIKey()}}}>Clear API key</button>    
    </div>    
{/if}
<footer>
    <p>
        Source code on <a href="https://github.com/kilkelly/multiprompt" target="_blank" rel="noopener">GitHub</a>. Powered by <a href="https://nano-gpt.com/" target="_blank" rel="noopener">NanoGPT</a>, <a href="https://nano.org/" target="_blank" rel="noopener">Nano</a> and <a href="https://github.com/kilkelly/nanogptjs" target="_blank" rel="noopener">NanoGPTJS</a>.
    </p>
</footer>

<style>

    header, footer, .panel {
        background-color: #2e3439;
    }

    main {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    #about {
        margin: 1.5rem;
    }

    footer {
        text-align: center;
    }

    footer p {
        margin: 0;
        padding: 0.5rem;
    }    

    h1 {
        margin: 0.3rem 0;
        font-size: 2.5rem;
    }

    #balance {
        margin: 1rem 0;
    }

    .reply, .reply-error {
        background-color: #FFF;
        color: #000;
        border-radius: 10px;
        padding: 1rem;        
        margin-top: 1rem;
        font-size: 1.2rem;
    }

    .reply-error {
        background-color: pink;
    }    

    textarea {
        padding: 1rem;
        margin-bottom: 0.5rem;
        font-size: 18px;
        max-width: 90%;
        font-family: "Nunito", "Helvetica Neue", Helvetica, Arial, sans-serif;		
        border-radius: 20px;
        background-color: #c5c7c9;
        color: #000;
    }

    textarea::placeholder {
        color: #333;
        opacity: 1; /* Firefox */
    }    

    #multi {
        width: 100%;
        display: flex;
        flex-direction: row;
        overflow-y: hidden;
        overflow-x: scroll;
        scrollbar-color: #2e3439 #454a4f;
        scrollbar-width: auto;
        padding-bottom: 1rem;
    }

    select {
        font-size: 1rem;
        padding: 0.5rem 0.2rem;
        font-family: "Nunito", "Helvetica Neue", Helvetica, Arial, sans-serif;		
    }

    #chat-button {
        margin-bottom: 2.5rem;
        width: 250px;
    }

    .panel {
        padding: 1rem;        
        width: 100%;
        margin: 0 0.2rem;      
        border-radius: 10px;  
        color: #FFF;
        display: flex;
        flex-direction: column;
    }

    #number-of-models {
        display: flex;
        align-items: center;
        margin-bottom: 1rem;
        padding: 1rem;        
    }

    #number-of-models button{
        margin: 0 0.3rem;
        padding: 0.5rem 1rem;
        font-weight: bold;
    }

    img#chatting {
        width: 100px;
        height: auto;
    }

    header {
        display: flex;
        flex-direction: column;
        align-items: end;
        padding-right: 1rem;
    }

    select, button {
        cursor: pointer;
    }

    #model-type-choose input, #model-type-choose label {
        cursor: pointer;
    }

    #model-type-choose {
        padding-top: 0.8rem;
        padding-bottom: 1rem;
    }    

    #model-type-choose label:nth-child(2) {
        padding-right: 1.5rem;
    }        

    #api-key {
        width: 300px;
    }

    .error-message {
        color: pink;
    }

    #splash-screen {
        margin: 5rem 0;
    }

    summary {
        font-size: 1.3rem;
        margin-top: 0.5rem;
        cursor: pointer;
    }

    details p {
        font-size: 1.1rem;
    }

    .image {
        max-width: 750px;
        height: auto;
    }

    header, footer, .panel, textarea {
        box-shadow: 1px 16px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    #history-grid {
        display: grid;
        grid-template-columns: 1fr 0.3fr 0.2fr 6fr;
        gap: 0.2rem;
        padding-top: 2rem;
        padding-bottom: 2rem;
    }

    #history-grid > span {
        background-color: #222;
        padding: 0.4rem;        
    }   
    
    .history-table-header {
        background-color: #000 !important;
    }

    #clear-api-key {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 1rem 0;        
    }

</style>