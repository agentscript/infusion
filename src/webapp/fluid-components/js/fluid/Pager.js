/*
Copyright 2008 University of Toronto

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://source.fluidproject.org/svn/LICENSE.txt
*/

/*global jQuery*/
/*global fluid_0_6*/

fluid_0_6 = fluid_0_6 || {};

(function ($, fluid) {

    /******************
     * Pager Bar View *
     ******************/

    
    function updateStyles(pageListThat, newModel, oldModel) {
        if (oldModel.pageIndex !== undefined) {
            var oldLink = pageListThat.pageLinks.eq(oldModel.pageIndex);
            oldLink.removeClass(pageListThat.options.styles.pageIndex);
        }
        var pageLink = pageListThat.pageLinks.eq(newModel.pageIndex);
        pageLink.addClass(pageListThat.options.styles.pageIndex); 


    };
    
    function bindLinkClick(link, events, eventArg) {
       link.unbind("click.fluid.pager");
       link.bind("click.fluid.pager", function() {events.initiatePageChange.fire(eventArg)});
    }
    
    fluid.directPageList = function (container, events, options) {
        var that = fluid.initView("fluid.directPageList", container, options);
        that.pageLinks = that.locate("pageLinks");
        for (var i = 0; i < that.pageLinks.length; ++ i) {
            var pageLink = that.pageLinks.eq(i);
            bindLinkClick(pageLink, events, {pageIndex: i});
        }
        events.onModelChange.addListener(
            function (newModel, oldModel) {
                updateStyles(that, newModel, oldModel);
            }
        );
        that.defaultModel = {
            pageIndex: 0,
            pageSize: 1,
            totalRange: that.pageLinks.length
        };
        return that;
    };
    
    var updatePreviousNext = function (that, options, newModel) {
        if (newModel.pageIndex === 0) {
            that.previous.addClass(options.styles.disabled);
        } else {
            that.previous.removeClass(options.styles.disabled);
        }
        
        if (newModel.pageIndex == newModel.pageCount - 1) {
            that.next.addClass(options.styles.disabled);
        } else {
            that.next.removeClass(options.styles.disabled);
        }
    };
    
    fluid.previousNext = function (container, events, options) {
        var that = fluid.initView("fluid.previousNext", container, options);
        that.previous = that.locate("previous");
        bindLinkClick(that.previous, events, {relativePage: -1});
        that.next = that.locate("next");
        bindLinkClick(that.next, events, {relativePage: +1});
        events.onModelChange.addListener(
            function (newModel, oldModel, overallThat) {
                updatePreviousNext(that, options, newModel);
            }
        );
        return that;
    };

    fluid.pagerBar = function (overallThat, container, options) {
        var that = fluid.initView("fluid.pagerBar", container, options);
        that.pageList = fluid.initSubcomponent(that, "pageList", [container, overallThat.events, that.options, fluid.COMPONENT_OPTIONS]);
        that.previousNext = fluid.initSubcomponent(that, "previousNext", [container, overallThat.events, that.options, fluid.COMPONENT_OPTIONS]);
        
        return that;
    };
    
    fluid.defaults("fluid.pagerBar", {
            
       previousNext: "fluid.previousNext",
      
       pageList: "fluid.directPageList",
        
       pageSizeSelect: "fluid.pageSizeSelect",
      
       selectors: {
           pageLinks: ".page-link",
           previous: ".previous",
           next: ".next"
       },
       
       styles: {
           pageIndex: "current-page",
           disabled: "disabled"
       }
    });

    function computePageCount(model) {
        model.pageCount = model.totalRange / model.pageSize;      
    }

    /*******************
     * Pager Component *
     *******************/
    
    fluid.pager = function (container, options) {
        var that = fluid.initView("fluid.pager", container, options);
        
        that.events.initiatePageChange.addListener(
            function(arg) {
               var newModel = fluid.copy(that.model);
               if (arg.relativePage !== undefined) {
                   newModel.pageIndex = that.model.pageIndex + arg.relativePage;
               }
               else {
                   newModel.pageIndex = arg.pageIndex;
               }
               if (newModel.pageIndex === undefined || newModel.pageIndex < 0) {
                   newModel.pageIndex = 0;
               }
               computePageCount(newModel);
               if (newModel.pageIndex >= newModel.pageCount) {
                   newModel.pageIndex = newModel.pageCount - 1;
               }
               that.events.onModelChange.fire(newModel, that.model, that);
               fluid.model.copyModel(that.model, newModel);
            }
        );

        // Setup the top and bottom pager bars.
        that.pagerBar = fluid.initSubcomponent(that, "pagerBar", [that, that.locate("pagerBar"), fluid.COMPONENT_OPTIONS]);
        that.pagerBarDuplicate = fluid.initSubcomponent(that, "pagerBar", [that, that.locate("pagerBarDuplicate"), fluid.COMPONENT_OPTIONS]);
 
        that.model = fluid.copy(that.options.model);
        if (that.model.totalRange === undefined) {
           that.model = that.pagerBar.pageList.defaultModel;
        }

        that.events.initiatePageChange.fire({pageIndex: 0});

        return that;        
    };
    
    fluid.defaults("fluid.pager", {
        pagerBar: "fluid.pagerBar",
        
        model: {
            pageIndex: undefined,
            pageSize: undefined,
            totalRange: undefined
        },
        
        selectors: {
            pagerBar: ".pager-top",
            pagerBarDuplicate: ".pager-bottom"
        },
        
        events: {
            initiatePageChange: null,
            onModelChange: null
        }
    });
})(jQuery, fluid_0_6);
