/* Copyright 2016- Paul Brewer, Economic and Financial Technology Consulting LLC */
/* This file is open source software.  The MIT License applies to this software.  */

/* global Plotly:true, $:true */

/* eslint no-console: "off" */
/* eslint consistent-this: ["error", "app", "that"] */

import clone from "clone";
import pEachSeries from "p-each-series";
import saveZip from "single-market-robot-simulator-savezip";
import openZip from "single-market-robot-simulator-openzip";
import * as Study from "single-market-robot-simulator-study";
export { Study };

/**
  * set the app progress bar text or value in #appProgressBar
  * @param {Object} options
  * @param {number} options.value bar percentage from 0.0 to 100.0
  * @param {string} options.text message text to be set above bar
  */

export function setProgressBar({value, text}){
  if (typeof(value)==='number'){
    const v = Math.min(100,Math.max(0,value));
      $('#appProgressBar')
        .prop({
          "aria-valuenow": v,
          "style": "width: " + v + "%"
        })
        .text(v + "%");
    }
  if (typeof(text)==='string'){
    $('#appProgressMessage').text(text);
  }
}

/**
 * Return size as an integer number of Megabytes + ' MB' rounded up
 * @param {string|number} nBytes  number of Bytes
 * @return {string} size description string "123 MB"
 */

function megaByteSizeStringRoundedUp(nBytes){
    return Math.ceil(+nBytes/1e6)+ ' MB';
}

/**
 *
 * Set Plotly interactivity based on #useInteractiveCharts checkbox
 * @param {Array<Object>} plotlyParams The plot to be modified
 */

 export function plotAddSelectedInteractivity(plotlyParams){
   const useStaticCharts = !($('#useInteractiveCharts').prop('checked'));
   if (!plotlyParams[2])
     plotlyParams[2] = {};
   plotlyParams[2].staticPlot = useStaticCharts;
   plotlyParams[2].displayModeBar = !useStaticCharts;
   plotlyParams[2].responsive = !useStaticCharts;
   plotlyParams[2].displaylogo = false;
   plotlyParams[2].showSendToCloud = !useStaticCharts;
   return plotlyParams;
 }

/**
 * Change Plotly plot title by prepending, appending, or replacing existing plot title
 * @param {Array<Object>} plotParams The plot to be modified -- a two element Array of [PlotlyTraces, PlotlyLayout]
 * @param {{prepend: ?string, append: ?string, replace: ?string}} modifier modifications to title
 */

export function adjustTitle(plotParams, modifier) {
  const layout = plotParams[1];
  if (layout) {
    if (modifier.replace && (modifier.replace.length > 0))
      layout.title = modifier.replace;
    if (layout.title) {
      if (modifier.prepend && (modifier.prepend.length > 0))
        layout.title = modifier.prepend + layout.title;
      if (modifier.append && (modifier.append.length > 0))
        layout.title += modifier.append;
    }
  }
}

/**
 * Use jQuery to manipulate DOM select element
 * @param {string} select - jQuery selector for select element, i.e. '#selector'
 * @param {Array<String>} options - array of strings for option labels (optional, but will blank previous options)
 * @param {number} selectedOption - the index of the selected option (optional)
 * @param {function(number)} onChange - called when user changes the selection (optional)
 */

function setSelectOptions({
  select,
  options,
  selectedOption,
  values
}) {
  $(select + ' > option')
    .remove();
  if (Array.isArray(options))
    options.forEach(
      (o, n) => {
        const s = (n === selectedOption) ? 'selected="selected"' : '';
        const v = (Array.isArray(values))? values[n]: n;
        $(select)
          .append(`<option value="${v}" ${s}>${o}</option>`);
      }
    );
}


function createJSONEditor({
  div,
  clear,
  options
}) {
  const editorElement = document.getElementById(div);
  if (editorElement && window.JSONEditor) {
    if (clear) {
      $('#'+div).empty();
    }
    return new window.JSONEditor(editorElement, options);
  }
}

/**
 * show the number of periods as indicated
 *
 * @param {number} number of periods to indicate
 * @return {number} the same number passed
 */

function showPeriods(periods) {
  $('input.periods')
    .val(periods);
  $('span.periods')
    .text(periods);
  return periods;
}

function emptyZipProgress(){
  $('div.openzip-progress').empty();
}

function showZipProgress(message) {
  // see https://stackoverflow.com/q/10776085/103081
  $('div.openzip-progress')
    .append("<p>" + message + "</p>")
    .scrollTop($('div.openzip-progress').prop("scrollHeight"));
}

function showZipError(e) {
  showZipProgress('<span class="red"> ERROR: ' + e + '</span>');
}

emptyZipProgress();

function restoreZipUI() {
  ($('button.openzip-button')
    .removeClass('disabled')
    .prop('disabled', false)
  );
}

function showZipSuccess() {
  emptyZipProgress();
  showZipProgress('<span class="green"> SUCCESS.  The data in the zip file has been loaded. Scroll down to interact with this data. </span>');
  restoreZipUI();
}

function showZipFailure(e) {
  if (e) showZipError(e);
  showZipProgress('<span class="red"> FAILURE. I could not use that zip file.  You may try again, choosing a different zip file');
  restoreZipUI();
}


class VizMaster {
  constructor(div){
    this.div = `#${div}`;
    this.empty();
  }
  empty(){
    $(this.div).empty();
    return this;
  }
  scaffold(n){
    let i=0;
    this.empty();
    while(i<n){
      let $row = $("<div>")
        .addClass("row")
        .appendTo(this.div);
      $("<div>", { id: `paramPlot${i}`})
        .addClass("paramPlot col-xs-12 col-md-4")
        .appendTo($row);
      $("<div>", { id: `resultPlot${i}`})
        .addClass("resultPlot col-xs-12 col-md-7")
        .appendTo($row);
      i += 1;
    }
  }
}

export class App {

  /**
   * Create App with given settings.  Many of these settings are required.
   * @param {Object} options
   * @param {Object} options.SMRS reference to either the imported module single-market-robot-simulator or a fork
   * @param {Object} options.DB "database" such as single-market-robot-simulator-db-googledrive for storing simulation configurations
   * @param {Object} options.Visuals object describing visualizations of completed simulations and parameters, to be interpreted by single-market-robot-simulator-viz-plotly
   * @param {Object} options.editorConfigSchema JSON Schema object for json-editor relevant to user editing of simulation configurations
   * @param {Object} options.editorStartValue default simulation configuration for editing if none are defined
   * @param {Array<Array<string>>} options.behavior click and eventmap stored as Array of 2 or 3 element arrays [jqSelector, appMethodName, [ eventType = click ] ]
   */

  constructor(options) {
    this.SMRS = options.SMRS;
    this.DB = options.DB;
    this.Visuals = options.Visuals;
    this.editorConfigSchema = options.editorConfigSchema;
    this.editorStartValue = options.editorStartValue;
    this.behavior = options.behavior;
    this.editor = 0;
    this.periodTimers = [];
    this.study = 0;
    this.availableStudies = [];
    this.chosenStudyIndex = 0;
    this.sims = [];
    this.visualIndex = 0;
    this.vizMaster = new VizMaster('study-results');
  }

  /**
   * Create new simulations for study
   * @param {Object} studyConfig The study configuration
   * @param {Array<Object>} studyConfig.configurations An array of SMRS.Simulation() configurations, one for each independent simulation in a study.
   * @param {Object} studyConfig.common Common single-market-robot-simulator configuration settings to be forced in all simulations in a study.
   * @param {boolean} runnable True for runnable simulation, false for facadeSimulation
   * @param {Array<number> || undefined} subset undefined->all, or an array of indices to use from studyConfig.configurations
   * @return {Array<Object>} array of new SMRS.Simulation - each simulation will be initialized but not running
   */

  simulations(studyConfig, runnable, subset) {
    const app = this;

    function FacadeSimulation(props) {
      this.config = props;
    }
    return Study.makeSimulations(studyConfig, (runnable) ? app.SMRS.Simulation : FacadeSimulation, subset);
  }

  /**
   * Get current study configuration
   * @return {Object} study configuration
   */

  getStudyConfig() {
    const app = this;
    return app.study && app.study.config;
  }

  /**
   * Get current StudyFolder
   * @return {Object} an instance implementing the StudyFolder interface
   */

  getStudyFolder() {
    const app = this;
    return app.study && app.study.folder;
  }

  /**
   * Set current study
   * @param {Object} studyConfig study configuraion
   */

  setStudy({
    config,
    folder
  }) {
    const app = this;

    app.study = {
      config,
      folder
    };
    if (folder) {
      if (folder.name)
        $('.onSetStudyFolderNameUpdateValue')
        .prop('value', folder.name);
      else
        $('.onSetStudyFolderNameUpdateValue')
        .prop('value', '');
      if (folder.id)
        $('.onSetStudyFolderIdUpdateValue')
        .prop('value', folder.id);
      else
        $('.onSetStudyFolderIdUpdateValue')
        .prop('value', '');
      if (folder.webViewLink)
        $('.onSetStudyFolderLinkUpdate').prop('href',folder.webViewLink);
      else
        $('.onSetStudyFolderLinkUpdate').prop('href',app.DB.defaultWebLink);
          if (folder && folder.listFiles){
            (folder
              .listFiles()
              .then((files) => (files.filter((f) => (f.mimeType === 'application/zip'))))
              .then((files) => {
                app.study.zipFiles = files;
              })
              .then(() => (app.renderPriorRunSelector()))
            );
          }
    } else {
      $('.onSetStudyFolderNameUpdateValue')
        .prop('value', '');
      $('.onSetStudyFolderIdUpdateValue')
        .prop('value', '');
      $('.onSetStudyFolderLinkUpdate').prop('href',app.DB.defaultWebLink);
    }
    const configTitle = (folder && folder.name) || (config && config.name) || 'UNTITLED';
    $('.configTitle')
      .text(configTitle);
    const modifiedTime = folder && folder.modifiedTime;
    const modifiedTimeStr = (modifiedTime) ? (new Date(modifiedTime)
      .toUTCString()) : '';
    $('.currentStudyFolderModifiedTime')
      .text(modifiedTimeStr);
    const description = (folder && folder.description) || (config && config.description) || '';
    $('.currentStudyFolderDescription')
      .text(description);
    if (config) {
      if (app.editor && app.initEditor) {
        app.initEditor({
          config: clone(config),
          schema: app.editorConfigSchema
        });
      }
      if (config.common && app.setPeriods){
        if (+config.common.periods>0){
          app.setPeriods(Math.min(100,+config.common.periods));
        } else {
          app.setPeriods(1);
        }
      }
      if (app.timeit) app.timeit(config);
      if (Study.numberOfSimulations(config) <= 4) app.refresh();
    }
  }

  /**
   * Get number of periods for next run of study, looks in study.common.periods
   * @return {number} number of periods
   */

  getPeriods() {
    const app = this;
    const config = app.getStudyConfig();
    return config && config.common.periods;
  }

  /**
   * Safely sets number of periods for the next run of the current study.  Affects config of cached app.study but not settings in editor.
   * @param {number} n number of periods
   */

  setPeriods(n) {
    const app = this;
    if (+n>0){
      const config = app.getStudyConfig();
      config.common.periods = +n;
      showPeriods(n);
      app.timeit(config);
    }
  }

  /**
   * Plot the parameters of a simulation into a numbered slot in the UI
   * Low level, for SMRS.Simulation --  For study level, see showParameters(conf)
   * @param {Object} sim - an instance of SMRS.Simulation
   * @param {number} slot - slot number, appended to "paramPlot" to get DOM id
   */

  plotParameters(sim, slot) {
    const app = this;
    const plotlyParams = app.Visuals.params(sim);
    plotAddSelectedInteractivity(plotlyParams);
    plotlyParams.unshift("paramPlot" + slot);
    Plotly.newPlot(...plotlyParams);
  }

  /**
   * Clears all class .paramPlot UI elements and plots all parameters of simulations in a study. Calls app.simulations and app.plotParameters.
   * completes updates to UI asynchronously, with 100ms pause between plots.
   * @param {Object} conf A study configuration compatible with app.simulations()
   */

  showParameters(conf) {
    const app = this;
    const sims = app.simulations(conf);
    const l = sims.length;
    let i = 0;

    function loop() {
      app.plotParameters(sims[i], i);
      i += 1;
      if (i < l) {
        setTimeout(loop, 100);
      }
    }
    setTimeout(loop, 100);
  }

  /**
   * Updates span.estimated-running-time with estimate of required running time for the current study, given the number of periods and the cached timing run,
   *
   */

  guessTime() {
    const app = this;
    const periodTimers = app.periodTimers;
    const periods = app.getPeriods();
    const configurations = Study.numberOfSimulations(app.getStudyConfig());
    const l = periodTimers.length;
    let guess = 0;
    if (periods) {
      if (l > 2) {
        guess = (periods * configurations * (periodTimers[l - 1] - periodTimers[1]) / (l - 2)) + periodTimers[1];
      } else if (l === 2) {
        guess = periods * configurations * periodTimers[1];
      }
      if (guess) {
        const seconds = Math.round(guess / 1000.0);
        const minutes = Math.ceil(seconds / 60);
        $('span.estimated-running-time')
          .text((minutes > 1) ? ('~' + minutes + 'min') : ('~' + seconds + 'sec'));
      } else {
        $('span.estimated-running-time')
          .text("?");
      }
    }
  }

  /**
   * Eventually updates Array<number> app.periodTimers by running a study for up to 5 periods or 5 seconds to get period finishing times. Calls guessTIme to update span.estimated-running-time
   * @param {Object} studyConfig - A studyConfig as defined by app.simulations
   */

  timeit(studyConfig) {
    const app = this;
    // delay running timeit by 1 sec as seems to be blocking screen refresh of description, etc.
    if (!studyConfig || !(Array.isArray(studyConfig.configurations))) return;
    setTimeout(function () {
      const t0 = Date.now();
      const periodTimers = app.periodTimers;
      periodTimers.length = 0;
      const randomIndex = Math.floor(Math.random()*Study.numberOfSimulations(studyConfig));
      const randomSim = app.simulations(
        studyConfig,
        app.SMRS.Simulation,
        [randomIndex])[0];
      const agents = randomSim.config.numberOfBuyers + randomSim.config.numberOfSellers;
      if (agents > 200) return;
      (randomSim
        .run({
          update: (sim) => {
            const elapsed = Date.now() - t0;
            periodTimers[sim.period] = elapsed;
            // hack to end simulations if over 2 sec or 5 periods
            if ((elapsed > 2000) || (sim.period > 5))
              sim.config.periods = sim.period;
            return sim;
          }
        })
        .then(
          () => {
            app.guessTime();
          })
        .catch((e) => (console.log(e)))
      );
    }, 1000);
  }

  /**
   * Eventually choose study n from Array app.availableStudies if possible, get details from DB, send it to app.editor and app.periodsEditor if defined, then app.timeit, and then refresh UI with app.refresh
   * @param {number} n index of chosen study in app.availableStudies[]
   */

  choose(n) {
    const app = this;
    $('div.openzip-progress').empty();
    app.vizMaster.empty();
    app.sims = [];
    if (Array.isArray(app.availableStudyFolders)) {
      app.chosenStudyIndex = Math.max(0, Math.min(Math.floor(n), app.availableStudyFolders.length - 1));
      app.availableStudyFolders[app.chosenStudyIndex].getConfig()
        .then((choice) => (app.setStudy(choice)));
    }
  }

  chooseRun(n) {
    const app = this;
    $('div.openzip-progress').empty();
    app.vizMaster.empty();
    app.sims = [];
    app.chosenRun = +n;
    const zipFile = app.study.zipFiles[n];
    if (zipFile && zipFile.webViewLink){
      $('.onChooseRunLinkUpdate').prop('href',zipFile.webViewLink);
    } else {
      $('.onChooseRunLinkUpdate').prop('href',app.DB.defaultWebLink);
    }
  }

  fetchChosenRun() {
    const app = this;
    app.openZipFile(app.chosenRun);
  }

  /**
   * Render #selector if it exists, by erasing all options and reading each study .title from app.availableStudies  You should define an empty select element in index.html with id "selector"
   */

  renderConfigSelector() {
    const app = this;
    const select = '#selector';
    const options = (
      app.availableStudyFolders &&
      app.availableStudyFolders.map((f) => (f.name))
    ) || []; // fails thru to empty set of options
    const selectedOption = 0;
    setSelectOptions({
      select,
      options,
      selectedOption
    });
  }

  /**
   * Render #priorRunSelector if it exists
   *
   */

    renderPriorRunSelector() {
        const app = this;
        const options = (
            app.study &&
                app.study.zipFiles &&
                app.study.zipFiles.map((f) => (f.name + ': ' + megaByteSizeStringRoundedUp(f.size)))
        ) || []; // fails thru to empty set of options
        const values = (
          app.study &&
          app.study.zipFiles &&
          app.study.zipFiles.map((f)=>(f.id))
        ) || [];
        const selectedOption = 0;
        app.chosenRun = 0;
        setSelectOptions({
            select: 'select.numericRunSelector',
            options,
            selectedOption
        });
        setSelectOptions({
          select: 'select.fileidRunSelector',
          options,
          selectedOption,
          values
        });
    }


  /**
   * get array of visualizations appropriate to the number of periods in the current study
   * if periods<=50, returns app.Visuals.small;  if 50<periods<=500, returns app.Visuals.medium; if periods>500, returns app.Visuals.large
   * @return {Array<function>} array of visualization functions generated from single-market-robot-simulator-viz-plotly
   */

  getVisuals() {
    const app = this;
    const numberOfSimulations = app.sims && app.sims.length;
    let part1 = (numberOfSimulations>1)? (app.Visuals.summary) : [];
    const periods = app.getPeriods();
    if (periods <= 50)
      return part1.concat(app.Visuals.small);
    if (periods <= 500)
      return part1.concat(app.Visuals.medium);
    return part1.concat(app.Visuals.large);
  }


  /**
   * plot simulation data plot into "slot" at div with id resultPlot+slot using chosen visual; adjust plot title per sim.config.title{append,prepend,replace}
   * @param {Object} simConfig An instance of SMRS.Simulation with finished simulation data in the logs
   * @param {number} slot
   */

  showSimulation(simConfig, slot) {
    const app = this;
    const visuals = app.getVisuals();
    const plotlyParams = visuals[app.visualIndex % visuals.length](simConfig);
    const config = simConfig.config;
    adjustTitle(
      plotlyParams, {
        prepend: config.titlePrepend,
        append: config.titleAppend,
        replace: config.titleReplace
      }
    );
    plotAddSelectedInteractivity(plotlyParams);
    plotlyParams.unshift('resultPlot' + slot);
    Plotly.newPlot(...plotlyParams);
  }

  /**
   * Render visualization options for current app.study into DOM select existing at id #vizselect
   */

  renderVisualSelector() {
    const app = this;
    const visuals = app.getVisuals();
    const select = '#vizselect';
    const options = (visuals && (visuals.map((v) => (v.meta.title || v.meta.f)))) || [];
    const selectedOption = app.visualIndex;
    setSelectOptions({
      select,
      options,
      selectedOption
    });
  }

  /**
   *  Expand the number of buyers and sellers (unless the number is 1, which is preserved), expanding the array(s) of buyerValues and sellerCosts via the how function
   *   how should be callable like this how(buyerValueorSellerCostArray, xfactor) and return a new array of values or costs
   */

  expand(how) {
    const app = this;
    const xfactor = +$('#xfactor')
      .val();
    const config = app.getStudyConfig();
    app.setStudy({
      config: Study.expand(config, xfactor, how)
    });
  }

  /** Perform additional required initialization, NOT called by constructor. Sets up (1) app.behavior with jQuery.on; (2) JSON Editor in div with id editor; (3) begins reading database for saveList
   */

  init() {
    const app = this;
    app.initBehavior();
    if (app.editorStartValue && app.editorConfigSchema)
      app.initEditor({
        config: app.editorStartValue,
        schema: app.editorConfigSchema
      });
    app.initDB();
  }

  initBehavior() {
    const app = this;
    app.behavior.forEach((v) => {
      let [jqSelector, appMethod, eventName] = v;
      if (typeof(app[appMethod]) !== 'function')
        throw new Error("Error initializing app behavior - method " + appMethod + " specified in event map for selector " + jqSelector + " does not exist");
      let selection = $(jqSelector);
      if (selection.length === 0)
        throw new Error("Error initializing app behavior - selector " + jqSelector + " not found in app's web page");
      selection.on(eventName || 'click', ((evt) => app[appMethod](evt && evt.target && evt.target.value)));
    });
    $('body').removeClass('disabledMouse');
  }

  initEditor({
    config,
    schema
  }) {
    const app = this;
    if (typeof(config) !== 'object')
      throw new Error("config must be an object, instead got: " + typeof(config));
    if (typeof(schema) !== 'object')
      throw new Error("schema must be an object, instead got: " + typeof(schema));
    const editorOptions = {
      schema,
      startval: config
    };
    app.editor = createJSONEditor({
      div: 'editor',
      clear: true,
      options: editorOptions
    });
  }

  initDB() {
    const app = this;
    if (app.DB)
      (app.DB.listStudyFolders()
        .then((items) => {
          if (Array.isArray(items) && (items.length)) {
            app.availableStudyFolders = items;
            app.renderConfigSelector();
            app.choose(0);
          }
        })
        .catch((e) => {
          console.log("app-framework initDB() Error accessing simulation configuration database:" + e);
        })
      );
  }

  /**
   * renderMorph
   * setup UI for Morph after tab click
   */

  renderMorphEditor() {
    const app = this;
    $('#morphError').text('');
    if (app.editor) {
      const config = app.editor.getValue();
      const l = config && config.configurations && config.configurations.length;
      if (!l || (l !== 2)){
        $('#morphError').text('morph requires exactly 2 configurations. This study currently has '+l+' configurations');
        throw new Error("app.renderMorph morph requires exactly 2 configurations");
      }
      const A = config.configurations[0];
      const B = config.configurations[1];
      if (!(Study.isMorphable(A, B))){
        $('#morphError').text('The two configurations are NOT compatible');
        throw new Error("app.renderMorph morph requires configurations that pass Study.isMorphable");
      }
      const schema = Study.morphSchema(A, B);
      const hasConfigMorph = config.morph && (Object.keys(config.morph).length>0);
      const startval = (hasConfigMorph && config.morph) || schema.default;
      app.morphEditor = createJSONEditor({
        div: 'morphEditor',
        clear: true,
        options: {
          schema,
          startval
        }
      });
    }
  }

  /**
   * morphs the edited configuration and stuffs it back in the editor
   */

  doMorph() {
    const app = this;
    if (app.editor && app.morphEditor) {
      const config = (
        Object.assign(
          {},
          Study.simplify(app.editor.getValue()),
          { morph: app.morphEditor.getValue() }
        )
      );
      app.editor.setValue(config);
      $('#editLink')
        .click(); // send user to Editor tab to rename/edit/save
    }
  }


  /**
   * refreshes a number of UI elements
   */

  refresh() {
    const app = this;
    const study = app.getStudyConfig();
    const periods = app.getPeriods();
    showPeriods(periods);
    if (study) {
      app.showParameters(study);
      const sims = app.simulations(study);
      $('#xsimbs')
        .html(
          "<tr>" + (sims
            .map(
              (sim, j) => {
                const data = [j, sim.numberOfBuyers, sim.numberOfSellers];
                return "<td>" + data.join("</td><td>") + "</td>";
              })
            .join('</tr><tr>')
          ) + "</tr>");
      app.plotParameters(sims[0], "ScaleUp");
    }
  }

  /**
   * expands the current study by creating new values and costs by interpolation
   */

  interpolate() {
    const app = this;
    app.expand(Study.expander.interpolate);
  }

  /**
   * expands the current study by duplicating unit costs and values
   */

  duplicate() {
    const app = this;
    app.expand(Study.expander.duplicate);
  }

  /**
   * abandon edits to the current study by refreshing the UI and editor from the cache
   */

  undo() {
    const app = this;
    app.choose(app.chosenStudyIndex);
  }

  /**
   * move the current study to the trash list
   * DISABLED pending REMOVAL -- 17 Nov 2019
   */

  moveToTrash() {
    throw new Error("...framework: moveToTrash no longer supported");
  }

  /**
   * run the current study and display a visualization
   *
   * requires there to be CSS classes enabledMouse and disabledMouse
   * which set pointer-events: none and pointer-events: auto respectively
   */

  run() {
    const app = this;
    function uiDone() {
      $('.spinning')
        .removeClass('spinning');
      $('body').removeClass('disabledMouse');
      $('.btn-danger').removeClass('enabledMouse');
    }
    $('body').addClass('disabledMouse');
    $('.btn-danger').addClass('enabledMouse');
    $('#runError')
      .empty();
    $('#runButton .glyphicon')
      .addClass("spinning");
    const studyConfig = app.getStudyConfig();
    app.sims = app.simulations(studyConfig, true);
    app.renderVisualSelector();
    app.vizMaster.scaffold(app.sims.length);
    app.stopped = false;
    setProgressBar({
      value: 0,
      text: 'Generating market data...only red buttons are usable'
    });
    return ( pEachSeries(app.sims, (sim, slot)=>(
        sim.run({
          update: (s)=>{
            const updateThreshold = Math.max(
              1,
              Math.ceil(s.config.periods/100)
            );
            if ((s.period % updateThreshold)!==0) return s;
            const simProgressRatio = s.period/s.config.periods;
            const studyProgressRatio = (slot+simProgressRatio)/app.sims.length;
            const studyProgressPct = Math.round(100*studyProgressRatio);
            setProgressBar({
              value: studyProgressPct
            });
            return s;
          }
        })
      )).then(
        ()=>{
          uiDone();
          setProgressBar({
            value: 100,
            text: 'Generation complete'
          });
          const canUpload = $('#canUploadAfterRun').prop('checked');
          if (!canUpload) return;
          if (app.stopped) {
            return console.log("run aborted by user -- aborting save");
          }
          console.log("saving....");
          setTimeout(()=>{
            app.uploadData();
          }, 1000);
        },
        (e)=>{
          uiDone();
          $('#runError').html("<pre>"+e+"</pre>");
          setProgressBar({
            text: "Generation Error!"
          });
        }
    ));
  }

  /**
   * stop a run of the current study
   * should have no effect unless study is running
   */

  stop() {
    const app = this;
    // trigger normal completion
    app.stopped = true;
    app.sims.forEach((sim) => {
      sim.config.periods = sim.period || 0;
    });
  }

  /**
   * tries to save the current study from the editor. try to save in place if name is unchanged.  If new name, create a new StudyFolder and save.  Reload the browser after saving.
   *
   * Previous behavior was to Save to the top of the app DB saveList, if the title is changed.  Otherwise, in place (remove/save).
   * Finally, reload the browser to give the app a clean restart.
   *
   */

  save() {
    const app = this;
    const myStudyFolder = app.getStudyFolder();
    let config = app.editor.getValue();
    if (!config.customcaseids) {
      delete config.common.caseid;
      config.configurations.forEach((c)=>{ delete c.caseid; });
    }
    if (config.simplify){
      config = Study.simplify(config);
    }

    /*
     * if name is unchanged, try to save in place
     *
     */

    if (myStudyFolder && (config.name === myStudyFolder.name))
      return (
        myStudyFolder
        .setConfig({
          config
        })
        .then(
          () => (window.location.reload()),
          (e) => (window.alert(e)) // eslint-disable-line no-alert
        )
      );

    /*
     * name is different, or no myStudyFolder, so create a new Study Folder then save
     *
     */

    /* first check if new name is already taken */

    const existingFolderAtName = app.availableStudyFolders.find((f)=>(f.name===config.name));

    if (existingFolderAtName){
      return window.alert("Conflict: A folder with the selected 'name' already exists."+ // eslint-disable-line no-alert
      " Please edit the 'name' and save again.");
    }

    return (app.DB.createStudyFolder({
        name: config.name
      })
      .then((folder) => (folder.setConfig({
        config
      })))
      .then(
        () => (window.location.reload()),
        (e) => (window.alert(e)) // eslint-disable-line no-alert
      )
    );

  }

  /**
   * Select a visualization from the visualization list but don't draw it yet.
   * @param {number} n Visualization index in Visuals array
   */

  setVisualNumber(n) {
    const app = this;
    app.visualIndex = n;
  }

  /**
  *
  * Draw the selected visualization
  */

  drawVisuals(){
    const app = this;
    const visuals = app.getVisuals();
    const vidx = app.visualIndex % visuals.length;
    const visual = visuals[vidx];
    if (visual.meta.input==='study') {
      const plotlyParams = visual(app.sims);
      plotAddSelectedInteractivity(plotlyParams);
      plotlyParams.unshift('study-visual');
      Plotly.newPlot(...plotlyParams);
    } else {
      app.sims.forEach((s, j) => app.showSimulation(s, j));
    }
  }

  /**
   * Create  .zip file containing study and simulation configurations and data and give it to the user
   */

  downloadData() {
    const app = this;
    $('#downloadButton')
      .prop('disabled', true);
    $('#downloadButton')
      .addClass("disabled");
    $('#downloadButton .glyphicon')
      .addClass("spinning");
    setTimeout(() => {
      saveZip({
          config: clone(app.getStudyConfig()),
          sims: app.sims,
          download: true
        })
        .then(() => {
          $('#downloadButton .spinning')
            .removeClass("spinning");
          $('#downloadButton')
            .removeClass("disabled");
          $('#downloadButton')
            .prop('disabled', false);
        });
    }, 200);
  }

  /**
   * Create .zip file containing study and simulation configurations and data and upload it to the cloud
   */

  uploadData() {
    const app = this;
    const study = clone(app.getStudyConfig());
    const folder = app.getStudyFolder();
    const name = Study.myDateStamp() + '.zip';
    if (folder && folder.upload) {
      setProgressBar({
        value: 0,
        text: 'Saving '+name
      });
      (saveZip({
            config: study,
            sims: app.sims,
            download: false
          })
          .then((zipBlob) => (
            folder.upload({
                name,
                blob: zipBlob,
                onProgress: (x) => {
                  const { loaded, total, type } = x;
                  if (type==='progress'){
                    setProgressBar({
                      value: Math.round(100*loaded/total)
                    });
                  }
                }
              })))
          .then((newfile) => {
              setProgressBar({
                  text: 'Saved '+name,
                  value: 100
              });
              if (Array.isArray(app.study.zipFiles)){
                  app.study.zipFiles.unshift(newfile);
                  app.renderPriorRunSelector();
              }
            })
          .catch((e) => {
                console.log(e);
                $('#runError').append('<pre> Error Saving '+name+"\n"+e+'</pre>');
              })
        );
    } else {
      console.log("folder is read only, cannot upload new data");
      $('#runError').append('folder is read only, cannot upload new data');
    }
  }

  /**
   * return a promise resolving to a zip file of saved data
   * @param {Object} zipFile representation compatible with app.study.download
   */

  zipPromise(zipFile) {
    const app = this;
    showZipProgress("chosen zip file is:" + JSON.stringify(zipFile));
    const zipFileMB = megaByteSizeStringRoundedUp(zipFile.size);
    if (zipFile.size> (200*1000*1000)){
      const msg = "File Too Big: Aborted reading this "+zipFileMB+" zipfile as it would likely crash your browser or device."+
        "You can continue analysis by manually downloading the zipfile to your PC, unzipping, and using suitable tools. "+
        "Unzipping will reveal csv files that should be compatible with Python, R, Stata, Excel, or other stats/spreadsheet software.";
      window.alert(msg); // eslint-disable-line no-alert
      return Promise.reject("zip file download aborted. Exceeds 200 MB");
    }
    if (zipFile.size > (50 * 1000 * 1000)){
      const ask = "If you are using a mobile device, fetching this "+zipFileMB+
      " zipfile could crash your browser, increase your mobile data bill,"+
      " or cause other issues. Desktops can sometimes handle ~100 MB zipfiles. Proceed?";
      if (!window.confirm(ask)){    // eslint-disable-line no-alert
          return Promise.reject("zip file download aborted by user");
      }
    }
    showZipProgress("reading from Google Drive");
    return app.study.folder.download(zipFile);
  }

  /**
   * open a .zip file associated with current study folder
   */

  openZipFile(chosenSavedRun) {
    const app = this;
    const zipFile = app.study.zipFiles[+chosenSavedRun];
    ($('button.openzip-button')
      .prop('disabled', true)
      .addClass("disabled")
    );
    setTimeout(() => {
      (openZip(app.zipPromise(zipFile), app.SMRS, showZipProgress)
        .then(function (data) {
          if (!(data.config)) throw new Error("No master configuration file (config.json) was found in zip file.  Maybe this zip file is unrelated.");
          if (!(data.sims.length)) throw new Error("No simulation configuration files (sim.json) in the zip file");
          app.vizMaster.scaffold(data.sims.length);
          if ((Array.isArray(data.config.configurations)) &&
            (Study.numberOfSimulations(data.config) !== data.sims.length))
            throw new Error("Missing files.  the number of configurations generated by config.json does not match the number of simulation directories and files I found");
          if (data.sims.includes(undefined))
            throw new Error("It seems a folder has been deleted from the zip file or I could not read it. ");
          return data;
        })
        .then(function (data) {
          app.sims = data.sims;
          app.renderVisualSelector();
        })
        .then(showZipSuccess)
        .catch(showZipFailure)
      );
    }, 50);
  }

  /**
   * render into the div with id "trashList" the study folders found in Trash. Trash items can be clicked to restore to editor.
   * DISABLED pending removal -- Nov 17 2019
   */

  renderTrash() {
    throw new Error("...app-framework: rendering Trash no longer supported");
  }
}
