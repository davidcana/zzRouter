/* ES6 module suppoort */
const global_zpt = {};

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.zpt = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(_dereq_,module,exports){
/*
    I18NDomain class
*/
"use strict";

var context = _dereq_( '../../context.js' );

var I18NDomain = function( stringToApply ) {
    
    var string = stringToApply;
    
    var putToAutoDefineHelper = function( scope, autoDefineHelper ){
        
        var newString = string;
        var conf = context.getConf();
        
        // Add the domains defined previously
        var previousValue = scope.get( conf.i18nDomainVarName );
        if ( previousValue ) {
            newString += conf.inDefineDelimiter + conf.i18nDomainVarName;
        }
        
        // Add brackets if not present
        if ( newString[ 0 ] !== '[' ){
            newString = '[' + newString + ']';
        }
        
        // Add i18nDomainVarName to the autoDefineHelper
        autoDefineHelper.put(
            conf.i18nDomainVarName,
            newString
        );
    };

    var dependsOn = function(){
        return [];
    };
    
    var update = function(){
        // Nothing to do
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        putToAutoDefineHelper: putToAutoDefineHelper,
        dependsOn: dependsOn,
        update: update,
        toString: toString,
        type: I18NDomain.id
    };
};

I18NDomain.id = 'i18n:domain';

I18NDomain.build = function( string ) {
    return string? new I18NDomain( string.trim() ): null;
};

module.exports = I18NDomain;

},{"../../context.js":20}],2:[function(_dereq_,module,exports){
/*
    I18nLanguage class
*/
"use strict";

var context = _dereq_( '../../context.js' );

var I18NLanguage = function( stringToApply ) {
    
    var string = stringToApply;
    
    var putToAutoDefineHelper = function( autoDefineHelper ){

        // Add i18nLanguageVarName to the autoDefineHelper
        autoDefineHelper.put(
            context.getConf().i18nLanguageVarName,
            string
        );
    };
    
    var dependsOn = function(){
        return [];
    };
    
    var update = function(){
        // Nothing to do
    };
    
    var toString = function(){
        return "I18NLanguage: " + string;
    };
    
    return {
        putToAutoDefineHelper: putToAutoDefineHelper,
        dependsOn: dependsOn,
        update: update,
        toString: toString,
        type: I18NLanguage.id
    };
};

I18NLanguage.id = 'i18n:language';

I18NLanguage.build = function( string ) {
    return string? new I18NLanguage( string.trim() ): null;
};

module.exports = I18NLanguage;

},{"../../context.js":20}],3:[function(_dereq_,module,exports){
/*
    METALDefineMacro class
*/
"use strict";

var METALDefineMacro = function( nameToApply ) {
    
    var name = nameToApply;
    
    var process = function( scope, node ){
        
        // Hide macro definitions
        node.style.display = 'none';

        return false;
    };

    var dependsOn = function(){
        return [];
    };
    
    var toString = function(){
        return "METALDefineMacro: " + name;
    };
    
    return {
        process: process,
        dependsOn: dependsOn,
        toString: toString,
        type: METALDefineMacro.id
    };
};

METALDefineMacro.id = 'metal:define-macro';

METALDefineMacro.build = function( string ) {
    return new METALDefineMacro( string.trim() );
};

module.exports = METALDefineMacro;

},{}],4:[function(_dereq_,module,exports){
/*
    METALFillSlot class
*/
"use strict";

var expressionsUtils = _dereq_( '../../expressions/expressionsUtils.js' );

var METALFillSlot = function( _string, _expression, _useMacroNode ) {
    
    var string = _string;
    var expression = _expression;
    var useMacroNode = _useMacroNode;
    
    var process = function(){
        // Nothing to do
    };
    
    var dependsOn = function( scope ){
        return expressionsUtils.buildDependsOnList( undefined, scope, expression );
    };
    
    var update = function( parserUpdater ){
        parserUpdater.updateNode( useMacroNode );
    };
    
    var toString = function(){
        return "METALFillSlot: " + string;
    };
    
    return {
        process: process,
        dependsOn: dependsOn,
        update: update,
        toString: toString,
        type: METALFillSlot.id
    };
};

METALFillSlot.id = 'metal:fill-slot';

METALFillSlot.build = function( string, useMacroNode ) {
    var expressionBuilder = _dereq_( '../../expressions/expressionBuilder.js' );
    
    return new METALFillSlot( 
            string,
            expressionBuilder.build( string ),
            useMacroNode
    );
};

module.exports = METALFillSlot;

},{"../../expressions/expressionBuilder.js":39,"../../expressions/expressionsUtils.js":41}],5:[function(_dereq_,module,exports){
/*
    METALUseMacro class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var expressionBuilder = _dereq_( '../../expressions/expressionBuilder.js' );
var expressionsUtils = _dereq_( '../../expressions/expressionsUtils.js' );
var attributeIndex = _dereq_( '../attributeIndex.js' );
var attributeCache = _dereq_( '../../cache/attributeCache.js' );
var TALDefine = _dereq_( '../TAL/talDefine.js' );
var METALFillSlot = _dereq_( './metalFillSlot.js' );
var resolver = _dereq_( '../../resolver.js' );

var METALUseMacro = function( stringToApply, macroExpressionToApply, defineToApply ) {
    
    var string = stringToApply;
    var macroExpression = macroExpressionToApply;
    var define = defineToApply;
    
    var process = function( scope, node, autoDefineHelper, indexExpressions ){

        // Init some vars
        var macroKey = resolver.getMacroKey( macroExpression, scope );
        var tags = context.getTags();
        var newNode = resolver.getNode( macroKey, scope ); 
        
        // Hide use macro node
        node.style.display = 'none';

        // Remove style attribute to force showing the new node
        newNode.removeAttribute( 'style' );

        // Update define and autoDefine attributes of the new node
        updateNewNodeAttributes( macroKey, newNode, autoDefineHelper, tags, node, indexExpressions );
        
        // Fill slots
        fillSlots( scope, node, tags, newNode, indexExpressions );

        // Add the macro node
        node.parentNode.insertBefore( newNode, node.nextSibling );
        
        return newNode;
    };
    
    var updateNewNodeAttributes = function( macroKey, newNode, autoDefineHelper, tags, node, indexExpressions ){

        // Update the talDefine attribute
        TALDefine.updateAttribute( newNode, define );
        
        // Update the talAutoDefine attribute
        var macroData = resolver.getMacroData( macroKey );
        if ( macroData.url ){
            autoDefineHelper.put( 
                context.getConf().externalMacroUrlVarName, 
                "'" + macroData.url + "'"
            );
            autoDefineHelper.updateNode( newNode );
        }
        
        // Set related id attribute if needed
        if ( indexExpressions ){
            newNode.setAttribute( 
                tags.relatedId, 
                node.getAttribute( tags.id ) 
            );
        }
    };
    
    var fillSlots = function( scope, node, tags, newNode, indexExpressions ){
        
        var list = node.querySelectorAll( 
            "[" + resolver.filterSelector( tags.metalFillSlot ) + "]"
        );
        var element;
        var pos = 0;
        while ( element = list[ pos++ ] ) {
            var slotIdExpressionString = element.getAttribute( tags.metalFillSlot );
            var slotIdExpression = expressionBuilder.build( slotIdExpressionString );
            var slotId = slotIdExpression.evaluate( scope );

            // Index fill slot element
            if ( indexExpressions ){
                var metalFillSlot = attributeCache.getByAttributeClass( 
                    METALFillSlot, 
                    slotIdExpressionString, 
                    element,
                    indexExpressions,
                    scope,
                    function(){
                        return METALFillSlot.build( slotIdExpressionString, node );
                    }
                );
                attributeIndex.add( element, metalFillSlot, scope );   
            }

            // Do nothing if slotIdExpression evaluates to false
            if ( ! slotId ){
                return;
            }

            var slotContent = element.cloneNode( true );
            var currentNode = newNode.querySelector( 
                "[" + resolver.filterSelector( tags.metalDefineSlot ) + "='" + slotId + "']"
            );
            if ( ! currentNode ){
                throw 'Slot "' + slotId + '" in expression "' + slotIdExpressionString +'" not found!';
            }
            currentNode.parentNode.insertBefore( 
                slotContent, 
                currentNode.nextSibling
            );
            slotContent.removeAttribute( tags.metalFillSlot );
            slotContent.setAttribute( tags.id, context.nextExpressionCounter() ); // Set a new id attribute to avoid id conflicts
            currentNode.remove();
        }
    };
    
    var dependsOn = function( scope ){
        return expressionsUtils.buildDependsOnList( undefined, scope, macroExpression );
    };
    
    var update = function( parserUpdater, node ){
        parserUpdater.updateNode( node );
    };
    
    var toString = function(){
        return "METALUseMacro: " + string;
    };
    
    return {
        process: process,
        dependsOn: dependsOn,
        update: update,
        toString: toString,
        type: METALUseMacro.id
    };
};

METALUseMacro.id = 'metal:use-macro';

METALUseMacro.build = function( string, stringDefine ) {
    var expressionBuilder = _dereq_( '../../expressions/expressionBuilder.js' );
    
    return new METALUseMacro( 
            string,
            expressionBuilder.build( string.trim() ),
            stringDefine? stringDefine.trim(): undefined
    );
};

module.exports = METALUseMacro;

},{"../../cache/attributeCache.js":17,"../../context.js":20,"../../expressions/expressionBuilder.js":39,"../../expressions/expressionsUtils.js":41,"../../resolver.js":90,"../TAL/talDefine.js":11,"../attributeIndex.js":16,"./metalFillSlot.js":4}],6:[function(_dereq_,module,exports){
/* 
    contentHelper singleton class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var expressionBuilder = _dereq_( '../../expressions/expressionBuilder.js' );
var evaluateHelper = _dereq_( '../../expressions/evaluateHelper.js' );

module.exports = (function() {

    var formInputHasBody = {
        BUTTON: 1,
        LABEL: 1,
        LEGEND: 1,
        FIELDSET: 1,
        OPTION: 1
    };
    
    var build = function( tag, string, constructorFunction ) {

        // Process it
        var content = string.trim();

        // Check if is an HTML expression
        var structure = content.indexOf( context.getConf().htmlStructureExpressionPrefix + ' ' ) === 0;
        var expressionString = structure? 
            content.substr( 1 + context.getConf().htmlStructureExpressionPrefix.length ): 
            content;
        if ( ! expressionString ){
            throw tag + ' expression void.';
        }
        
        return constructorFunction(
            string,
            expressionBuilder.build( expressionString ),
            structure,
            expressionString
        );
    };
    
    var updateNode = function( node, structure, evaluated ){

        // Check default
        if ( evaluateHelper.isDefault( evaluated ) ){
            return true;
        }

        // Check nothing
        if ( evaluateHelper.isNothing( evaluated ) ){
            evaluated = "";
        }

        // Add it to node
        node.innerHTML = evaluated;
        if ( ! structure ) {
            node[ "form" in node && !formInputHasBody[ node.tagName ] ? "value": "innerText" ] = evaluated;
        }

        return true;
    };
    
    return {
        build: build,
        updateNode: updateNode
    };
})();

},{"../../context.js":20,"../../expressions/evaluateHelper.js":37,"../../expressions/expressionBuilder.js":39}],7:[function(_dereq_,module,exports){
/*
    TALAttributes class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var ExpressionTokenizer = _dereq_( '../../expressions/expressionTokenizer.js' );
var expressionsUtils = _dereq_( '../../expressions/expressionsUtils.js' );
var utils = _dereq_( '../../utils.js' );

var TALAttributes = function( stringToApply, attributeItemsToApply ) {
    
    var string = stringToApply;
    var attributeItems = attributeItemsToApply;
    
    var process = function( scope, node, attributeName ){
        
        for ( var i = 0; i < attributeItems.length; i++ ) {
            var attributeItem = attributeItems[ i ];
            var name = attributeItem.name;
            
            if ( ! attributeName || name === attributeName ){
                var value = attributeItem.expression.evaluate( scope );

                if ( name ){
                    processSimpleAttributeItem( node, name, value );
                } else {
                    processMapAttributeItem( node, value );
                }
            }
        }
    };

    var processMapAttributeItem = function( node, map ){
    
        // Do nothing if map is null
        if ( ! map ){
            return;
        }
        
        if ( ! utils.isPlainObject( map ) ){
            throw 'Invalid attribute value: "' + map + '". Object expected.';
        }
        
        for ( var name in map ){
            var value = map[ name ];
            processSimpleAttributeItem( node, name, value );
        }
    };
    
    var processSimpleAttributeItem = function( node, name, value ){
        
        // Boolean attributes
        if ( context.isBooleanAttribute( name ) ){
            if ( value ){
                node.setAttribute( name, '' );
            } else {
                node.removeAttribute( name );
            }
            return;
        }
        
        // If value is undefined don't parser the attribute
        if ( value == undefined ) {
            return;
        }
            
        // Alt attributes
        if ( context.isAltAttribute( name ) ) {
            switch ( name ) {
            case "innerHTML":
                throw node; // should use "qtext"
            case "style":
                node.style.cssText = value;
                break;
            /*
            case "text":
                node[ querySelectorAll ? name : innerText ] = value;
                break; // option.text unstable in IE
            */
            case "class":
                name = "className";
            default:
                node[ name ] = value;
            }
            return;
        } 

        // Regular attributes
        node.setAttribute( name, value );
    };

    var dependsOn = function( scope ){

        var result = [];
        var object = {};
        
        for ( var i = 0; i < attributeItems.length; i++ ) {
            var attributeItem = attributeItems[ i ];
            var dependsOnList = expressionsUtils.buildDependsOnList( undefined, scope, attributeItem.expression );
            if ( dependsOnList && dependsOnList.length > 0 ){
                object[ attributeItem.name ] = dependsOnList;
            }
        }
        
        if ( Object.keys( object ).length > 0 ){
            result.push( object );
        }
        
        return result;
    };
    
    var update = function( parserUpdater, node, scope, indexItem ){
        process( scope, node, indexItem.groupId );
    };
    
    var toString = function(){
        return "TALAttributes: " + string;
    };
    
    return {
        process: process,
        dependsOn: dependsOn,
        update: update,
        toString: toString,
        type: TALAttributes.id
    };
};

TALAttributes.id = 'tal:attributes';

TALAttributes.build = function( string ) {

    var expressionBuilder = _dereq_( '../../expressions/expressionBuilder.js' );
    
    var attributeItems = [];
    var expressionString = string.trim();
    var tokens = new ExpressionTokenizer( 
            expressionString, 
            context.getConf().attributeDelimiter, 
            true );

    while ( tokens.hasMoreTokens() ) {
        var attribute = tokens.nextToken().trim();
        var space = attribute.indexOf( context.getConf().inAttributeDelimiter );
        if ( space === -1 ) {
            attributeItems.push({
                name: undefined,
                expression: expressionBuilder.build( attribute )
            });
        }
        var name = attribute.substring( 0, space );
        var valueExpression = attribute.substring( space + 1 ).trim();

        attributeItems.push({
            name: name,
            expression: expressionBuilder.build( valueExpression )
        });
    }
    
    return new TALAttributes( string, attributeItems );
};

module.exports = TALAttributes;

},{"../../context.js":20,"../../expressions/expressionBuilder.js":39,"../../expressions/expressionTokenizer.js":40,"../../expressions/expressionsUtils.js":41,"../../utils.js":94}],8:[function(_dereq_,module,exports){
/*
    TALCondition class
*/
"use strict";

var evaluateHelper = _dereq_( '../../expressions/evaluateHelper.js' );
var expressionsUtils = _dereq_( '../../expressions/expressionsUtils.js' );
var context = _dereq_( '../../context.js' );

var TALCondition = function( stringToApply, expressionToApply ) {
    
    var string = stringToApply;
    var expression = expressionToApply;
    
    var process = function( scope, node ){
        
        var result = evaluateHelper.evaluateBoolean( scope, expression );
        
        node.setAttribute( context.getTags().conditionResult, result );
        node.style.display = result ? '' : 'none';
        
        return result;
    };

    var dependsOn = function( scope ){
        return expressionsUtils.buildDependsOnList( undefined, scope, expression );
    };
    
    var update = function( parserUpdater, node ){
        parserUpdater.updateNode( node, true );
    };
    
    var updatableFromAction = function( parserUpdater, node ){
        
        var scope = parserUpdater.getNodeScope( node );
        var result = evaluateHelper.evaluateBoolean( scope, expression );
        var valueFromTag = 'true' === node.getAttribute( context.getTags().conditionResult );
        
        return result !== valueFromTag;
    };
    
    var toString = function(){
        return "TALCondition: " + string;
    };
    
    return {
        process: process,
        dependsOn: dependsOn,
        update: update,
        updatableFromAction: updatableFromAction,
        toString: toString,
        type: TALCondition.id
    };
};

TALCondition.id = 'tal:condition';

TALCondition.build = function( string ) {
    
    var expressionBuilder = _dereq_( '../../expressions/expressionBuilder.js' );
    
    return new TALCondition( 
                string,
                expressionBuilder.build( string ) );
};

module.exports = TALCondition;

},{"../../context.js":20,"../../expressions/evaluateHelper.js":37,"../../expressions/expressionBuilder.js":39,"../../expressions/expressionsUtils.js":41}],9:[function(_dereq_,module,exports){
/*
    TALContent class
*/
"use strict";

var evaluateHelper = _dereq_( '../../expressions/evaluateHelper.js' );
var contentHelper = _dereq_( './contentHelper.js' );
var expressionsUtils = _dereq_( '../../expressions/expressionsUtils.js' );

var TALContent = function( stringToApply, expressionToApply, structureToApply ) {
    
    var string = stringToApply;
    var expression = expressionToApply;
    var structure = structureToApply;
    
    var process = function( scope, node ){
        
        return contentHelper.updateNode( 
            node, 
            structure, 
            evaluateHelper.evaluateToNotNull( scope, expression ) 
        );
    };

    var dependsOn = function( scope ){
        return expressionsUtils.buildDependsOnList( undefined, scope, expression );
    };
    
    var update = function( parserUpdater, node, scope ){
        process( scope, node );
    };
    
    var toString = function(){
        return "TALContent: " + string;
    };
    
    return {
        process: process,
        dependsOn: dependsOn,
        update: update,
        toString: toString,
        type: TALContent.id
    };
};

TALContent.id = 'tal:content';

TALContent.build = function( string ) {
    
    return contentHelper.build( 
        'TALContent',
        string,
        function( _string, _expression, _structure ){
            return new TALContent( _string, _expression, _structure );
        }
    );
};

module.exports = TALContent;

},{"../../expressions/evaluateHelper.js":37,"../../expressions/expressionsUtils.js":41,"./contentHelper.js":6}],10:[function(_dereq_,module,exports){
/*
    TALDeclare class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var ExpressionTokenizer = _dereq_( '../../expressions/expressionTokenizer.js' );
var expressionsUtils = _dereq_( '../../expressions/expressionsUtils.js' );

var TALDeclare = function( _string, _declareItems ) {
    
    var string = _string;
    var declareItems = _declareItems;
    
    var process = function( scope, autoDefineHelper ){

        putVariables( scope, autoDefineHelper );

        return processDeclareItems( scope );
    };
    
    var putVariables = function( scope, autoDefineHelper ) {
        
        // Add strictModeVarName to the autoDefineHelper if needed
        var strictModeVarName = context.getConf().strictModeVarName;
        if ( true !== scope.get( strictModeVarName ) ){
            autoDefineHelper.put( strictModeVarName, 'true' );
        }
        
        // Build declared and required
        var declaredVarsVarName = context.getConf().declaredVarsVarName;
        var declared = scope.get( declaredVarsVarName ) || [];
        for ( var i = 0; i < declareItems.length; i++ ) {
            var declareItem = declareItems[ i ];
            declared.push( declareItem.name );
        }
        
        // Add declaredVarsVarName to the autoDefineHelper
        autoDefineHelper.put( 
            declaredVarsVarName, 
            expressionsUtils.buildList( declared, true )
        );
    };
    
    var processDeclareItems = function( scope ) {
        
        var errorsArray = [];

        for ( var i = 0; i < declareItems.length; i++ ) {
            var declareItem = declareItems[ i ];
            var errors = checkDeclareItem(
                scope,
                declareItem.name,
                declareItem.type,
                declareItem.required,
                declareItem.defaultValueString,
                declareItem.defaultValueExpression
            );
            errorsArray = errorsArray.concat( errors );
        }

        processErrorsArray( errorsArray );

        return errorsArray.length === 0;
    };

    var checkDeclareItem = function( scope, name, type, required, defaultValueString, defaultValueExpression ) {
        
        var errorsArray = [];
        
        var value = scope.get( name );
        
        // Set default value if needed
        if ( value === undefined && defaultValueExpression !== undefined ){
            var setDefaultValueError = setDefaultValue( scope, name, type, defaultValueString, defaultValueExpression );
            if ( setDefaultValueError ){
                errorsArray.push( setDefaultValueError );
                return errorsArray;
            }
            value = scope.get( name );
        }
        
        // Check type
        var typeCheckError = checkType( name, type, value );
        if ( typeCheckError ){
            errorsArray.push( typeCheckError );
        }
        
        // Check required
        var requiredCheckError = checkRequired( name, required, value );
        if ( requiredCheckError ){
            errorsArray.push( requiredCheckError );
        }
        
        return errorsArray;
    };
    
    var checkType = function( name, expectedType, value ) {
        
        if ( ! expectedType ){
            return;
        }
        
        var realType = getTypeOf( value );
        return realType === expectedType.toLowerCase()? 
            false: 
            'Expected value type (' + expectedType.toLowerCase() + ') of ' + name + ' property does not match type (' + realType + '), value is "' + value + '".';
    };
    
    /*
        typeOf();                   // undefined
        typeOf(null);               // null
        typeOf(NaN);                // number
        typeOf(5);                  // number
        typeOf([]);                 // array
        typeOf('');                 // string
        typeOf(function () {});     // function
        typeOf(/a/)                 // regexp
        typeOf(new Date())          // date
        typeOf(new Error)           // error
        typeOf(Promise.resolve())   // promise
        typeOf(function *() {})     // generatorfunction
        typeOf(new WeakMap())       // weakmap
        typeOf(new Map())           // map
        typeOf({});                 // object
        typeOf(new MyConstructor()) // MyConstructor
    */
    var getTypeOf = function( value ){
        
        var temp = {}.toString.call( value ).split(' ')[ 1 ].slice( 0, -1 ).toLowerCase();
        return temp === 'object'? 
            value.constructor.name.toLowerCase(): 
            temp;
    };
    
    var checkRequired = function( name, required, value ) {
        
        return true === required && value === undefined? 
            'Required value must not be undefined: ' + name:
            false;
    };
    
    var setDefaultValue = function( scope, name, type, defaultValueString, defaultValueExpression ) {
        
        try {
            var defaultValue = defaultValueExpression.evaluate( scope );
            scope.set( name, defaultValue );
            return false;
            
        } catch ( e ) {
            return 'Error trying to evaluate default value of field ' + name + ', expression [' + defaultValueString + ']: ' + e;
        }
    };
    
    var processErrorsArray = function( errorsArray ) {

        if ( errorsArray.length === 0 ){
            return;
        }
        
        throw errorsArray;
    };
    
    var dependsOn = function(){
        return [];
    };
    
    var update = function(){
        // Nothing to do
    };
    
    var toString = function(){
        return "TALDeclare: " + string;
    };
    
    return {
        process: process,
        dependsOn: dependsOn,
        update: update,
        toString: toString,
        type: TALDeclare.id
    };
};

TALDeclare.id = 'tal:declare';

TALDeclare.build = function( string ) {

    var expressionBuilder = _dereq_( '../../expressions/expressionBuilder.js' );

    var declareItems = [];
    var omitTypes = [ 'undefined', 'null' ];
    
    var tokens = new ExpressionTokenizer( 
        string.trim(), 
        context.getConf().declareDelimiter, 
        true 
    );

    while ( tokens.hasMoreTokens() ) {
        
        var inPropTokens = new ExpressionTokenizer( 
            tokens.nextToken().trim(), 
            context.getConf().inDeclareDelimiter, 
            true 
        );
        
        var name = undefined;
        var type = undefined;
        var defaultValueString = undefined;
        var required = false;
        var state = 1;
        while ( inPropTokens.hasMoreTokens() ){
            var currentToken = inPropTokens.nextToken();
            if ( TALDeclare.tokenIsRequired( currentToken ) ){
                required = true;
                continue;
            }
            switch ( state ) {
                case 1:
                    name = currentToken;
                    break;
                case 2:
                    if ( -1 === omitTypes.indexOf( currentToken.toLowerCase() ) ){
                        type = currentToken;   
                    }
                    break;
                case 3:
                    defaultValueString = currentToken;
                    break;
                default:
                    throw 'Too many arguments in talDeclare item: ' + string.trim();
            }
            ++state;
        }
        
        // The name is the only required element
        if ( ! name ){
            continue;
        }
        
        declareItems.push({
            name: name,
            type: type,
            required: required,
            defaultValueString: defaultValueString,
            defaultValueExpression: defaultValueString == undefined? undefined: expressionBuilder.build( defaultValueString )
        });
    }

    return new TALDeclare( string, declareItems );
};

TALDeclare.tokenIsRequired = function( token ) {
    return "required" === token.toLowerCase();
};

module.exports = TALDeclare;

},{"../../context.js":20,"../../expressions/expressionBuilder.js":39,"../../expressions/expressionTokenizer.js":40,"../../expressions/expressionsUtils.js":41}],11:[function(_dereq_,module,exports){
/*
    TALDefine class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var ExpressionTokenizer = _dereq_( '../../expressions/expressionTokenizer.js' );

var TALDefine = function( stringToApply, defineItemsToApply ) {
    
    var string = stringToApply;
    var defineItems = defineItemsToApply;
    
    var process = function( scope, forceGlobal ){
        
        // Update scope
        for ( var i = 0; i < defineItems.length; i++ ) {
            var defineItem = defineItems[ i ];
            scope.set( 
                    defineItem.name, 
                    defineItem.nocall? defineItem.expression: defineItem.expression.evaluate( scope ), 
                    forceGlobal || defineItem.global,
                    defineItem.nocall,
                    defineItem.expression
            );
        }
    };
    
    var dependsOn = function(){
        return [];
    };
    
    var update = function(){
        // Nothing to do
    };
    
    var toString = function(){
        return "TALDefine: " + string;
    };
    
    return {
        process: process,
        dependsOn: dependsOn,
        update: update,
        toString: toString,
        type: TALDefine.id
    };
};

TALDefine.id = 'tal:define';

TALDefine.build = function( string ) {

    var expressionBuilder = _dereq_( '../../expressions/expressionBuilder.js' );

    var defineItems = [];
    var expressionString = string.trim();
    var tokens = new ExpressionTokenizer( 
        expressionString, 
        context.getConf().defineDelimiter, 
        true );

    while ( tokens.hasMoreTokens() ) {
        var variable = tokens.nextToken().trim();
        var space = variable.indexOf( context.getConf().inDefineDelimiter );
        if ( space === -1 ) {
            throw 'Bad variable definition: ' + variable;
        }

        var nocall = false;
        var global = false;
        var currentToken = variable.substring( 0, space );
        var nextTokens = variable.substring( space + 1 ).trim();
        var tokenDone = false;
        do {
            var specialToken = false;
            if ( context.getConf().globalVariableExpressionPrefix === currentToken ){
                global = true;
                specialToken = true;
            } else if ( context.getConf().nocallVariableExpressionPrefix === currentToken ){
                nocall = true;  
                specialToken = true;
            } 
            
            if ( specialToken ){
                space = nextTokens.indexOf( context.getConf().inDefineDelimiter );
                currentToken = nextTokens.substring( 0, space );
                nextTokens = nextTokens.substring( space + 1 ).trim();
                
            } else {
                defineItems.push({
                    name: currentToken,
                    expression: expressionBuilder.build( nextTokens ),
                    global: global,
                    nocall: nocall
                });
                tokenDone = true;
            }

        } while( ! tokenDone && space !== -1 );
    }

    return new TALDefine( string, defineItems );
};


TALDefine.appendStrings = function() {
    
    var result = arguments[ 0 ];
    
    for ( var c = 1; c < arguments.length; ++c ){
        var string = arguments[ c ];
        if ( string ){
            result = result? result + context.getConf().defineDelimiter + string: string;
        }
    }
    
    return result;
};

TALDefine.updateAttribute = function( node, defineToAdd ){

    var tags = context.getTags();
    var nodeDefine = node.getAttribute( tags.talDefine );
    var fullDefine = TALDefine.appendStrings( defineToAdd, nodeDefine );

    if ( fullDefine ){
        node.setAttribute( tags.talDefine, fullDefine );
    }
};

module.exports = TALDefine;

},{"../../context.js":20,"../../expressions/expressionBuilder.js":39,"../../expressions/expressionTokenizer.js":40}],12:[function(_dereq_,module,exports){
/*
    TALOmitTag class
*/
"use strict";

var BooleanLiteral = _dereq_( '../../expressions/path/literals/booleanLiteral.js' );
var expressionsUtils = _dereq_( '../../expressions/expressionsUtils.js' );
var context = _dereq_( '../../context.js' );

var TALOmitTag = function( stringToApply, expressionToApply ) {
    
    var string = stringToApply;
    var expression = expressionToApply;
    
    var process = function( scope, node, parserNodeRenderer ){
        
        var result = expression.evaluate( scope );
        if ( ! result ){
            return false;
        }
        
        // Process the contents
        parserNodeRenderer.defaultContent( node );
        
        // Move children from current node to its parent and then remove it
        var tags = context.getTags();
        var parentNode = node.parentNode;
        while ( node.firstChild ) {
            if ( node.firstChild.nodeType === 1 ){
                node.firstChild.setAttribute( tags.qdup, 1 );
            }
            parentNode.appendChild( node.firstChild );
        }
        parentNode.removeChild( node );

        return true;
    };
    
    var dependsOn = function( scope ){
        return expressionsUtils.buildDependsOnList( undefined, scope, expression );
    };
    
    var update = function(){
        // Nothing to do
    };
    
    var toString = function(){
        return "TALOmitTag: " + string;
    };
    
    return {
        process: process,
        dependsOn: dependsOn,
        update: update,
        toString: toString,
        type: TALOmitTag.id
    };
};

TALOmitTag.id = 'tal:omit-tag';

TALOmitTag.build = function( string ) {
    
    var expressionBuilder = _dereq_( '../../expressions/expressionBuilder.js' );
    
    var expressionString = string.trim();
    var expression = expressionString == ''?
            new BooleanLiteral( true ):
            expressionBuilder.build( expressionString );
    
    return new TALOmitTag( string, expression );
};

module.exports = TALOmitTag;

},{"../../context.js":20,"../../expressions/expressionBuilder.js":39,"../../expressions/expressionsUtils.js":41,"../../expressions/path/literals/booleanLiteral.js":52}],13:[function(_dereq_,module,exports){
/*
    TALOnError class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var contentHelper = _dereq_( './contentHelper.js' );

var TALOnError = function( stringToApply, structureToApply ) {
    
    var string = stringToApply;
    var structure = structureToApply;
    
    var putToAutoDefineHelper = function( autoDefineHelper ){

        // Add onErrorVarName to the autoDefineHelper
        autoDefineHelper.put(
            context.getConf().onErrorVarName,
            string,
            true
        );
        
        // Add onErrorStructureVarName to the autoDefineHelper
        autoDefineHelper.put(
            context.getConf().onErrorStructureVarName,
            structure,
            false
        );
    };

    var dependsOn = function(){
        return [];
    };
    
    var update = function(){
        // Nothing to do
    };
    
    var toString = function(){
        return "TALOnError: " + string;
    };
    
    return {
        putToAutoDefineHelper: putToAutoDefineHelper,
        dependsOn: dependsOn,
        update: update,
        toString: toString,
        type: TALOnError.id
    };
};

TALOnError.id = 'tal:on-error';

TALOnError.build = function( string ) {

    return contentHelper.build( 
        'TALOnError',
        string,
        function( _string, _expression, _structure, _expressionString ){
            return new TALOnError( _expressionString, _structure );
        }
    );
};

module.exports = TALOnError;

},{"../../context.js":20,"./contentHelper.js":6}],14:[function(_dereq_,module,exports){
/*
    TALRepeat class
*/
"use strict";

var expressionsUtils = _dereq_( '../../expressions/expressionsUtils.js' );
var expressionBuilder = _dereq_( '../../expressions/expressionBuilder.js' );
var Loop = _dereq_( '../../parsers/loop.js' );

var TALRepeat = function( stringToApply, varNameToApply, expressionStringToApply ) {
    
    var string = stringToApply;
    var varName = varNameToApply;
    var expressionString = expressionStringToApply;
    var expression = expressionBuilder.build( expressionString );
    var loop;
    
    var process = function( scope ){
        loop = new Loop( varName, expressionString, scope );
        return loop;
    };
    
    var dependsOn = function( scope ){
        return expressionsUtils.buildDependsOnList( undefined, scope, expression );
    };
    
    var update = function( parserUpdater, node ){
        parserUpdater.updateNode( node );
    };
    
    var toString = function(){
        return "TALRepeat: " + string;
    };
    
    var getExpressionString = function(){
        return expressionString;
    };
    
    var getVarName = function(){
        return varName;
    };
    
    return {
        process: process,
        dependsOn: dependsOn,
        update: update,
        toString: toString,
        type: TALRepeat.id,
        getExpressionString: getExpressionString,
        getVarName: getVarName
    };
};

TALRepeat.id = 'tal:repeat';

TALRepeat.build = function( string ) {
    
    var expressionString = string.trim();
    var space = expressionString.indexOf( ' ' );
    if ( space === -1 ) {
        throw 'Bad repeat expression: ' + expressionString;
    }
    var varName = expressionString.substring( 0, space );
    var loopExpression = expressionString.substring( space + 1 );
    
    return new TALRepeat( string, varName, loopExpression );
};

module.exports = TALRepeat;

},{"../../expressions/expressionBuilder.js":39,"../../expressions/expressionsUtils.js":41,"../../parsers/loop.js":81}],15:[function(_dereq_,module,exports){
/*
    TALReplace class
*/
"use strict";

var evaluateHelper = _dereq_( '../../expressions/evaluateHelper.js' );
var contentHelper = _dereq_( './contentHelper.js' );
var expressionsUtils = _dereq_( '../../expressions/expressionsUtils.js' );

var TALReplace = function( stringToApply, expressionToApply, structureToApply ) {
    
    var string = stringToApply;
    var expression = expressionToApply;
    var structure = structureToApply;
    
    var process = function( scope, node ){
        
        // Evaluate
        var evaluated = evaluateHelper.evaluateToNotNull( scope, expression );
        
        // Check default
        if ( evaluateHelper.isDefault( evaluated ) ){
            return true;
        }

        // Check nothing
        if ( evaluateHelper.isNothing( evaluated ) ){
            evaluated = "";
        }
        
        if ( structure ){
            // Replace HTML
            node.outerHTML = evaluated;
            
        } else {
            // Replace original node by new text node
            var textNode = node.ownerDocument.createTextNode( evaluated );
            node.parentNode.replaceChild( textNode, node );
        }
        
        return true;
    };
    
    var dependsOn = function( scope ){
        //return expressionsUtils.buildDependsOnList( depsDataItem, scope, expression );
        return expressionsUtils.buildDependsOnList( undefined, scope, expression );
    };
    
    var update = function(){
        // Nothing to do
    };
    
    var toString = function(){
        return 'TALReplace: ' + string;
    };
    
    return {
        process: process,
        dependsOn: dependsOn,
        update: update,
        toString: toString,
        type: TALReplace.id
    };
};

TALReplace.id = 'tal:replace';

TALReplace.build = function( string ) {

    return contentHelper.build( 
        'TALReplace',
        string,
        function( _string, _expression, _structure ){
            return new TALReplace( _string, _expression, _structure );
        }
    );
};

module.exports = TALReplace;

},{"../../expressions/evaluateHelper.js":37,"../../expressions/expressionsUtils.js":41,"./contentHelper.js":6}],16:[function(_dereq_,module,exports){
/* 
    attributeIndex singleton class
*/
"use strict";

var utils = _dereq_( '../utils.js' );
var context = _dereq_( '../context.js' );

module.exports = (function() {
    
    var map;
    
    var reset = function(){
        map = {};
    };
    reset();
    
    var add = function( node, attributeInstance, scope ){
        
        addList(
            node,
            attributeInstance,
            attributeInstance.dependsOn( scope )
        );
    };
    
    var addList = function( node, attributeInstance, list, groupId ){
        
        for ( var i = 0; i < list.length; i++ ) {
            addAny( node, attributeInstance, list[ i ], groupId );
        }
    };
    var addObject = function( node, attributeInstance, item ){
        
        for ( var groupId in item ){
            addAny( node, attributeInstance, item[ groupId ], groupId );
        }
    };
    var addAny = function( node, attributeInstance, item, groupId ){
        
        if ( utils.isPlainObject( item ) ){
            addObject( node, attributeInstance, item );
        } else if ( Array.isArray( item ) ){
            addList( node, attributeInstance, item, groupId );
        } else {
            addVar( node, attributeInstance, item, groupId );
        }
    };
    /*
    var addVar = function( node, attributeInstance, varName, groupId  ){
        
        var list = map[ varName ];
        if ( ! list ){
            list = [];
            map[ varName ] = list;
        }

        list.push(
            {
                attributeInstance: attributeInstance,
                nodeId: node.getAttribute( context.getTags().id ),
                groupId: groupId
            }
        );
    };
    */
    var addVar = function( node, attributeInstance, varName, groupId  ){
        
        var list = map[ varName ];
        if ( ! list ){
            list = [];
            map[ varName ] = list;
        }
        
        var newItem = {
            attributeInstance: attributeInstance,
            nodeId: node.getAttribute( context.getTags().id ),
            groupId: groupId
        };
        
        //var index = list.findIndex( item => utils.deepEqual( item, newItem ) );
        var index = list.findIndex( 
            function( item ) { 
                return utils.deepEqual( item, newItem );
            }
        );
        if ( index === -1 ){
            list.push( newItem );
        } else {
            list[ index ] = newItem;
        }
    };
    
    var getVarsList = function( varName ){
        
        var items = map[ varName ];
        
        // Return an empty list if needed
        if ( items === undefined ){
            return [];
        }
        
        // Remove items with removed nodes
        cleanItems( items );
        
        // We must build another list to avoid sync errors
        var result = [];
        result = result.concat( items );
        return result;
    };
    
    //TODO findNodeById duplicated
    var findNodeById = function ( nodeId ) {
        
        return window.document.querySelector( 
            '[' + context.getTags().id + '="' + nodeId + '"]' 
        );
    };
    
    // Iterate through items and remove them when node does not exist in DOM
    var cleanItems = function( items ){
        
        var indexesToRemove = [];
        
        // Build list of items to remove
        for ( var i = 0; i < items.length; ++i ){
            var item = items[ i ];
            var node = findNodeById( item.nodeId );
            if ( ! node ){
                indexesToRemove.push( i );
            }
        }
        
        // Remove items
        for ( var j = indexesToRemove.length - 1; j >= 0 ; --j ){
            var indexToRemove = indexesToRemove[ j ];
            items.splice( indexToRemove, 1 );
        };
    };
    /*
    var removeVar = function( varName, nodeId ){
        
        var list = map[ varName ];

        var filtered = list.filter(
            function( value, index, arr ){
                return value.nodeId !== nodeId;
            }
        );

        map[ varName ] = filtered;
    };
    
    var removeVarFromNodes = function( varName, nodeIds ){
        
        var list = map[ varName ];

        var filtered = list.filter(
            function( value, index, arr ){
                return nodeIds.indexOf( value.nodeId ) === -1;
            }
        );

        if ( filtered.length === 0 ){
            delete map[ varName ];
        } else {
            map[ varName ] = filtered;
        }
        
    };
    
    var getAllNodeIds = function( target ){
        
        // Get the list
        var list = target.querySelectorAll( '[' + context.getTags().id + ']' );

        // Iterate the list
        var result = [];
        var nodeIdAttributeName = context.getTags().id;
        var node;
        var pos = 0;
        while ( node = list[ pos++ ] ) {
            result.push( 
                node.getAttribute( nodeIdAttributeName ) 
            );
        }
        
        return result;
    };
    
    var removeNode = function( node ){

        var nodeIds = getAllNodeIds( node );

        var nodeId = node.getAttribute( context.getTags().id );
        nodeIds.push( nodeId );
        
        for ( var varName in map ){
            removeVarFromNodes( varName, nodeIds );
        }
    };
    
    var removeMultipleNodes = function( nodeIds ){

        for ( var varName in map ){
            removeVarFromNodes( varName, nodeIds );
        }
    };
    */
    return {
        add: add,
        getVarsList: getVarsList,
        //removeVar: removeVar,
        //removeNode: removeNode,
        //removeMultipleNodes: removeMultipleNodes,
        reset: reset
    };
})();

},{"../context.js":20,"../utils.js":94}],17:[function(_dereq_,module,exports){
/*
    attributeCache singleton class
*/
"use strict";

var CacheHelper = _dereq_( './cacheHelper.js' );
var context = _dereq_( '../context.js' );
var log = _dereq_( '../logHelper.js' );
var attributeIndex = _dereq_( '../attributes/attributeIndex.js' );

module.exports = (function() {
    
    var map;
    
    var reset = function(){
        map = {};
    };
    reset();
    
    var get = function( attribute, string ) {
        
        var attributeMap = map[ attribute ];
        
        if ( ! attributeMap ){
            return null;
        }
         
        return attributeMap[ CacheHelper.hashCode( string ) ];
    };
    
    var put = function( attribute, string, value ){
        
        var attributeMap = map[ attribute ];
        
        if ( ! attributeMap ){
            attributeMap = {};
            map[ attribute ] = attributeMap;
        }
        
        attributeMap[ CacheHelper.hashCode( string ) ] = value;
    };
    
    var index = function( node, attribute, scope ){
        
        if ( node ){
            log.debug( 'Must index!' );
            attributeIndex.add( node, attribute, scope );
            
        } else {
            log.debug( 'Not indexed!' );
        }
        
        return attribute;
    };
    
    var getByDetails = function( attributeType, string, buildFunction, force, node, scope ) {
        
        log.debug( 
            'Request building of ZPT attribute "' + string + '", force "' + force + '"' );
        
        // Get from cache if possible
        if ( force || ! context.getConf().attributeCacheOn ){
            log.debug( 'Cache OFF!' );
            
        } else {
            log.debug( 'Cache ON!' );
            var fromCache = get( attributeType, string );
            if ( fromCache ){
                log.debug( 'Found in cache!' );
                //return fromCache;
                return index( node, fromCache, scope );
            } else {
                log.debug( 'NOT found in cache!' );
            }
        }
        
        // Force build and put into cache
        log.debug( 'Must build!' );
        var builded = buildFunction();
        put( attributeType, string, builded );
        //return builded;
        return index( node, builded, scope );
    };
    
    var getByAttributeClass = function( attributeInstance, string, node, indexExpressions, scope, constructor ) {
        
        return getByDetails( 
                attributeInstance.id, 
                string, 
                constructor || function(){
                    return attributeInstance.build( string );
                }, 
                false,
                indexExpressions? node: undefined,
                scope
        );
    };
    
    return {
        //getByDetails: getByDetails,
        getByAttributeClass: getByAttributeClass,
        reset: reset
    };
})();

},{"../attributes/attributeIndex.js":16,"../context.js":20,"../logHelper.js":67,"./cacheHelper.js":18}],18:[function(_dereq_,module,exports){
/*
    cacheHelper singleton class
*/
module.exports = (function() {
    "use strict";
    
    var hashCode = function( string ) {

        if ( Array.prototype.reduce ) {
            return string.split( "" ).reduce(
                function( a, b ){
                    a = ( ( a << 5 ) - a ) + b.charCodeAt( 0 );
                    return a&a
                },
                0 );
        }

        var hash = 0;
        if ( string.length === 0 ){
            return hash;
        }
        for ( var i = 0, len = string.length; i < len; i++ ) {
            var chr = string.charCodeAt( i );
            hash = ( ( hash << 5 ) - hash ) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        
        return hash;
    };
    
    return {
        hashCode: hashCode
    };
})();

},{}],19:[function(_dereq_,module,exports){
/*
    expressionCache singleton class
*/
module.exports = (function() {
    "use strict";
    
    var CacheHelper = _dereq_( './cacheHelper.js' );
    var context = _dereq_( '../context.js' );
    var log = _dereq_( '../logHelper.js' );
    
    var map = {};
    
    var get = function( string ) {
        return map[ CacheHelper.hashCode( string ) ];
    };
    
    var put = function( string, value ){
        map[ CacheHelper.hashCode( string ) ] = value;
    };
    
    var process = function( string, buildFunction, force ) {
        
        log.debug( 
            'Request building of expression "' + string + '", force "' + force + '"' );
        
        // Get from cache if possible
        if ( ! force && context.getConf().expressionCacheOn ){
            log.debug( 'Cache ON!' );
            var fromCache = get( string );
            if ( fromCache ){
                log.debug( 'Found in cache!' );
                return fromCache;
            } 
            log.debug( 'NOT found in cache!' );
            
        } else {
            log.debug( 'Cache OFF!' );
        }
        
        // Force build and put into cache
        log.debug( 'Must build!' );
        var builded = buildFunction();
        put( string, builded );
        return builded;
    };
    
    var clean = function( ) {
        map = {};
    };
    
    return {
        get: process,
        clean: clean
    };
})();

},{"../context.js":20,"../logHelper.js":67,"./cacheHelper.js":18}],20:[function(_dereq_,module,exports){
/* 
    context singleton class
*/

var log4javascript = _dereq_( 'log4javascript' );
var utils = _dereq_( './utils.js' );
var LoopItem = _dereq_( './parsers/loopItem.js' );
var CSSAnimationManager = _dereq_( './parsers/dictionaryActions/cssAnimationManager.js' );

module.exports = (function() {
    "use strict";
    
    /* Tags */
    var defaultTags = {
        talCondition:     "data-condition",
        talRepeat:        "data-repeat",
        talAttributes:    "data-attributes",
        talContent:       "data-content",
        talDefine:        "data-define",
        talAutoDefine:    "data-tauto-define",
        talOmitTag:       "data-omit-tag",
        talReplace:       "data-replace",
        talOnError:       "data-on-error",
        talDeclare:         "data-declare",
        metalDefineMacro: "data-define-macro",
        metalUseMacro:    "data-use-macro",
        metalDefineSlot:  "data-define-slot",
        metalFillSlot:    "data-fill-slot",
        metalMacro:       "data-mmacro",
        i18nDomain:       "data-domain",
        i18nLanguage:     "data-language",
        //scopeKey:         "data-scope-key",
        rootKey:          "data-root-key",
        qdup:             "data-qdup",
        id:               "data-id",
        relatedId:        "data-related-id",
        conditionResult:  "data-condition-result"
    };
    var originalTags = {
        talCondition:     "tal:condition",
        talRepeat:        "tal:repeat",
        talAttributes:    "tal:attributes",
        talContent:       "tal:content",
        talDefine:        "tal:define",
        talAutoDefine:    "tal:auto-define",
        talOmitTag:       "tal:omit-tag",
        talReplace:       "tal:replace",
        talOnError:       "tal:on-error",
        talDeclare:       "tal:declare",
        metalDefineMacro: "metal:define-macro",
        metalUseMacro:    "metal:use-macro",
        metalDefineSlot:  "metal:define-slot",
        metalFillSlot:    "metal:fill-slot",
        metalMacro:       "data-mmacro",
        i18nDomain:       "i18n:domain",
        i18nLanguage:     "i18n:language",
        //scopeKey:         "data-scope-key",
        rootKey:          "data-root-key",
        qdup:             "data-qdup",
        id:               "data-id",
        relatedId:        "data-related-id",
        conditionResult:  "data-condition-result"
    };
    var tags = defaultTags;
    var tal = '';
    
    var getTags = function (){
        return tags;
    };
    
    var setTags = function ( tagsToSet ){
        tags = tagsToSet;
        tal = '';
    };
    
    var getTal = function (){
        if ( tal === '' ){
            var c = 0;
            var notInclude = tags.qdup;
            for ( var property in tags ) {
                if ( notInclude === tags[ property ] ){
                    continue;
                }
                if ( c++ > 0){
                    tal += ",";
                }
                tal += "*[" + tags[ property ] + "]";
            }
        }
        
        return tal;
    };
    var useOriginalTags = function(){
        setTags( originalTags );
    };
    /* End Tags */
    
    /* Formatters */
    var formatters = {};
    formatters.lowerCase = function ( value ){
        return value.toLocaleLowerCase();
    };
    formatters.upperCase = function ( value ){
        return value.toLocaleUpperCase();
    };
    formatters.localeDate = function ( value ){
        return value.toLocaleDateString;
    };
    formatters.localeTime = function ( value ){
        return value.toLocaleTimeString;
    };
    formatters.localeString = function ( value, locale ){
        return locale? 
               value.toLocaleString( value, locale ): 
               value.toLocaleString( value );
    };
    formatters.fix = function ( number, fixTo ){
        return number.toFixed( fixTo );
    };
    
    var getFormatter = function ( id ){
        return formatters[ id ];
    };
    
    var registerFormatter = function ( id, formatter ){
        formatters[ id ] = formatter;
    };
    var unregisterFormatter = function ( id ){
        delete formatters[ id ];
    };
    /* End Formatters */
    
    /* Conf */
    var EXPRESSION_SUFFIX = ':';
    var PRIVATE_VARS_PREFIX = '_';
    var defaultConf = {
        pathDelimiter:          '|',
        pathSegmentDelimiter:   '/',
        expressionDelimiter:    ' ',
        intervalDelimiter:      ':',
        propertyDelimiter:      '/',
        defineDelimiter:        ';',
        inDefineDelimiter:      ' ',
        attributeDelimiter:     ';',
        inAttributeDelimiter:   ' ',
        domainDelimiter:        ' ',
        i18nOptionsDelimiter:   ';',
        inI18nOptionsDelimiter: ' ',
        argumentsDelimiter:     ',',
        macroDelimiter:         '@',
        declareDelimiter:         ';',
        inDeclareDelimiter:       ' ',
        
        i18nConfResourceId:      "/CONF/",
        
        htmlStructureExpressionPrefix:  "structure",
        globalVariableExpressionPrefix: "global",
        nocallVariableExpressionPrefix: "nocall",
        
        templateErrorVarName:    "error",
        onErrorVarName:          PRIVATE_VARS_PREFIX + "on-error",
        onErrorStructureVarName: PRIVATE_VARS_PREFIX + "on-error-structure",
        i18nDomainVarName:       PRIVATE_VARS_PREFIX + "i18nDomain",
        i18nLanguageVarName:     PRIVATE_VARS_PREFIX + "i18nLanguage",
        externalMacroUrlVarName: PRIVATE_VARS_PREFIX + "externalMacroUrl",
        strictModeVarName:       PRIVATE_VARS_PREFIX + "strictMode",
        declaredVarsVarName:     PRIVATE_VARS_PREFIX + "declaredVars",
        repeatVarName:           PRIVATE_VARS_PREFIX + "repeat",
        
        windowVarName:           "window",
        contextVarName:          "context",
        
        nothingVarName:          "nothing",
        defaultVarName:          "default",
        nothingVarValue:         "___nothing___",
        defaultVarValue:         "___default___",
        
        loggingOn:    false,
        loggingLevel: log4javascript.Level.ERROR,

        externalMacroPrefixURL: "",
        variableNameRE:         /^[A-Za-z0-9_/-]+$/,
        expressionCacheOn:      true,
        attributeCacheOn:       true,

        expressionSuffix:     EXPRESSION_SUFFIX,
        stringExpression:     "string" + EXPRESSION_SUFFIX,
        existsExpression:     "exists" + EXPRESSION_SUFFIX,
        notExpression:        "not" + EXPRESSION_SUFFIX,
        javaScriptExpression: "js" + EXPRESSION_SUFFIX,
        equalsExpression:     "eq" + EXPRESSION_SUFFIX,
        greaterExpression:    "gt" + EXPRESSION_SUFFIX,
        lowerExpression:      "lt" + EXPRESSION_SUFFIX,
        addExpression:        "+" + EXPRESSION_SUFFIX,
        subExpression:        "-" + EXPRESSION_SUFFIX,
        mulExpression:        "*" + EXPRESSION_SUFFIX,
        divExpression:        "/" + EXPRESSION_SUFFIX,
        modExpression:        "%" + EXPRESSION_SUFFIX,
        orExpression:         "or" + EXPRESSION_SUFFIX,
        andExpression:        "and" + EXPRESSION_SUFFIX,
        condExpression:       "cond" + EXPRESSION_SUFFIX,
        formatExpression:     "format" + EXPRESSION_SUFFIX,
        trExpression:         "tr" + EXPRESSION_SUFFIX,
        trNumberExpression:   "trNumber" + EXPRESSION_SUFFIX,
        trCurrencyExpression: "trCurrency" + EXPRESSION_SUFFIX,
        trDateTimeExpression: "trDate" + EXPRESSION_SUFFIX,
        inExpression:         "in" + EXPRESSION_SUFFIX,
        queryExpression:      "query" + EXPRESSION_SUFFIX,
        pathExpression:       "",
        
        firstIndexIdentifier: "_first_",
        lastIndexIdentifier:  "_last_"
    };
    var conf = defaultConf;
    
    var getConf = function (){
        return conf;
    };
    
    var setConf = function ( confToSet ){
        conf = confToSet;
    };
    /* End conf */
    
    /* Logger */
    var logger;
    var getDefaultLogger = function (){
        
        var defaultLogger = log4javascript.getDefaultLogger();
        
        defaultLogger.setLevel( getConf().loggingLevel );
        //defaultLogger.removeAllAppenders();
        //defaultLogger.addAppender( new log4javascript.BrowserConsoleAppender( true ) );
        
        return defaultLogger;
    };
    var getLogger = function (){
        
        if ( ! logger && getConf().loggingOn ){
            logger = getDefaultLogger();
        }
        
        return logger;
    };
    var setLogger = function ( loggerToSet ){
        logger = loggerToSet;
    };
    /* End Logger */
    
    /* 
        Boolean attributes:
        The presence of a boolean attribute on an element represents the true value, and the absence of the attribute represents the false value.
    */
    var booleanAttributes = {
        checked: 1,
        compact: 1,
        declare: 1,
        defer: 1,
        disabled: 1,
        ismap: 1,
        multiple: 1,
        nohref: 1,
        noresize: 1,
        noshade: 1,
        nowrap: 1,
        readonly: 1,
        selected: 1
    };
    
    var getBooleanAttributes = function (){
        return booleanAttributes;
    };
    var setBooleanAttributes = function ( booleanAttributesToSet ){
        booleanAttributes = booleanAttributesToSet;
    };
    var isBooleanAttribute = function ( attribute ){
        return booleanAttributes[ attribute ] === 1;
    };
    /* End Boolean attributes */
    
    /* 
        Alt attributes:
        Attributes which don't support setAttribute().
    */
    var altAttributes = {
        className: 1,
        class: 1,
        href: 1,
        htmlFor: 1,
        id: 1,
        innerHTML: 1,
        label: 1,
        style: 1,
        src: 1,
        text: 1,
        title: 1,
        value: 1
    };
    // All booleanAttributes are also altAttributes
    utils.extend( altAttributes, booleanAttributes );
    
    var getAltAttributes = function (){
        return altAttributes;
    };
    var setAltAttributes = function ( altAttributesToSet ){
        altAttributes = altAttributesToSet;
    };
    var isAltAttribute = function ( attribute ){
        return altAttributes[ attribute ] === 1;
    };
    /* End Alt attributes */
    
    /* Errors */
    var defaultErrorFunction = function( error ) {
        
        var msg = Array.isArray( error )?
            error.join( '\n' ):
            error;
        
        window.alert( msg );
        
        throw msg;
    };
    var errorFunction = defaultErrorFunction;
    var setErrorFunction = function( _errorFunction ){
        self.errorFunction = _errorFunction;
    };
    var asyncError = function( url, errorMessage, failCallback ){

        var msg = 'Error trying to get ' + url + ': ' + errorMessage;
        if ( failCallback ){
            failCallback( msg );
        } else {
            errorFunction( msg );
        }
    };
    /* End errors */
    
    /* Repeat */
    var repeat = function( index, length, offset ){
        return new LoopItem( index, length, offset );
    };
    /* End repeat*/
    
    /* Folder dictionaries */
    var folderDictionaries = [];
    var setFolderDictionaries = function( _folderDictionaries ){
        folderDictionaries = _folderDictionaries;
    };
    var getFolderDictionaries = function(){
        return folderDictionaries;
    };
    /* End folder dictionaries */
    
    /* Strict mode  */
    var strictMode = false;
    var setStrictMode = function( _strictMode ){
        strictMode = _strictMode;
    };
    var isStrictMode = function(){
        return strictMode;
    };
    /* End strict mode  */
    
    /* Expression counter */
    var expressionCounter = 0;
    var nextExpressionCounter = function(){
        return ++expressionCounter;
    };
    var setExpressionCounter = function( _expressionCounter ){
        expressionCounter = _expressionCounter;
    };
    /* End expression counter */
    
    /* Run counter */
    var runCounter = 0;
    var nextRunCounter = function(){
        return ++runCounter;
    };
    /* End run counter */
    
    /* Animation managers */
    var defaultAnimationManager = CSSAnimationManager;
    var animationManager = defaultAnimationManager;
    var getAnimationManager = function(){
        return animationManager;
    };
    var setAnimationManager = function( _animationManager ){
        animationManager = _animationManager;
    };
    /* End animation managers*/
    
    var self = {
        getTags: getTags,
        setTags: setTags,
        getTal: getTal,
        getFormatter: getFormatter,
        registerFormatter: registerFormatter,
        unregisterFormatter: unregisterFormatter,
        getConf: getConf,
        setConf: setConf,
        getLogger: getLogger,
        setLogger: setLogger,
        useOriginalTags: useOriginalTags,
        getBooleanAttributes: getBooleanAttributes,
        setBooleanAttributes: setBooleanAttributes,
        isBooleanAttribute: isBooleanAttribute,
        getAltAttributes: getAltAttributes,
        setAltAttributes: setAltAttributes,
        isAltAttribute: isAltAttribute,
        errorFunction: errorFunction,
        setErrorFunction: setErrorFunction,
        asyncError: asyncError,
        repeat: repeat,
        setFolderDictionaries: setFolderDictionaries,
        getFolderDictionaries: getFolderDictionaries,
        setStrictMode: setStrictMode,
        isStrictMode: isStrictMode,
        nextExpressionCounter: nextExpressionCounter,
        setExpressionCounter: setExpressionCounter,
        nextRunCounter: nextRunCounter,
        getAnimationManager: getAnimationManager,
        setAnimationManager: setAnimationManager
    };
    
    return self;
})();

},{"./parsers/dictionaryActions/cssAnimationManager.js":77,"./parsers/loopItem.js":82,"./utils.js":94,"log4javascript":97}],21:[function(_dereq_,module,exports){
/*
    AddExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var arithmethicHelper = _dereq_( './arithmethicHelper.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );

var AddExpression = function( stringToApply, expressionListToApply ) {
    
    var string = stringToApply;
    var expressionList = expressionListToApply;
    
    var evaluate = function( scope ){

        return arithmethicHelper.evaluate( 
            string,
            scope,
            expressionList, 
            AddExpression.mathOperation, 
            function( total, value ){
                return total + value;
            } 
        );
    };
    
    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, expressionList );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

AddExpression.removePrefix = true;
AddExpression.getPrefix = function() {
    return context.getConf().addExpression;
};
AddExpression.mathOperation = 'add';
AddExpression.getId = AddExpression.mathOperation;

AddExpression.build = function( string ) {
    
    var expressionList = arithmethicHelper.build( 
            string,
            AddExpression.mathOperation 
    );

    return new AddExpression( string, expressionList );
};

module.exports = AddExpression;

},{"../../context.js":20,"../expressionsUtils.js":41,"./arithmethicHelper.js":22}],22:[function(_dereq_,module,exports){
/* 
    arithmethicHelper singleton class
*/
module.exports = (function() {
    "use strict";
    
    var context = _dereq_( '../../context.js' );
    var ExpressionTokenizer = _dereq_( '../expressionTokenizer.js' );
    var evaluateHelper = _dereq_( '../evaluateHelper.js' );
    
    var build = function( string, tag ) {
        var expressionBuilder = _dereq_( '../expressionBuilder.js' );

        if ( string.length === 0 ) {
            throw tag + " expression void.";
        }
        
        var segments = new ExpressionTokenizer( 
                string, 
                context.getConf().expressionDelimiter, 
                false 
        );

        return expressionBuilder.buildList( segments );
    };
    
    var evaluate = function( string, scope, expressionList, mathOperation, arithmethicFunction ) {
        
        // Evaluate segments
        var result = 0;
        var c = 0;
        
        for ( var i = 0; i < expressionList.length; i++ ) {
            var expression = expressionList[ i ];
            var evaluated = expression.evaluate( scope );
            
            if ( ! Array.isArray( evaluated ) ){ 
                // Process numeric value
                result = processInteger( 
                    c++, 
                    evaluated, 
                    result, 
                    arithmethicFunction, 
                    mathOperation, 
                    expression );
                
            } else {
                // Process array of numeric
                for ( var j = 0; j < evaluated.length; j++ ) {
                    result = processInteger( 
                        c++, 
                        evaluated[ j ], 
                        result, 
                        arithmethicFunction, 
                        mathOperation, 
                        expression );
                }
            }
        }
        
        if ( c < 2 ) {
            throw 'Error in expression "' + string + '". Only one element in evaluation of "' + mathOperation 
                + '" expression, please add at least one more.';
        }
        
        return result;
    };
    
    var processInteger = function( c, value, result, arithmethicFunction, mathOperation, expression ){
        
        if ( ! evaluateHelper.isNumber( value ) ) {
            throw "Error trying doing math operation, value '" + value 
                    + "' is not a valid number in expression '" + mathOperation + ' ' + expression + "'";
        }

        return c == 0? Number( value ): arithmethicFunction( result, Number( value ) );
    };
    
    return {
        build: build,
        evaluate: evaluate
    };
})();

},{"../../context.js":20,"../evaluateHelper.js":37,"../expressionBuilder.js":39,"../expressionTokenizer.js":40}],23:[function(_dereq_,module,exports){
/*
    DivideExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var arithmethicHelper = _dereq_( './arithmethicHelper.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );

var DivideExpression = function( stringToApply, expressionListToApply ) {
    
    var string = stringToApply;
    var expressionList = expressionListToApply;
    
    var evaluate = function( scope ){

        return arithmethicHelper.evaluate( 
            string,
            scope,
            expressionList, 
            DivideExpression.mathOperation, 
            function( total, value ){
                return total / value;
            } 
        );
    };

    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, expressionList );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

DivideExpression.removePrefix = true;
DivideExpression.getPrefix = function() {
    return context.getConf().divExpression;
};
DivideExpression.mathOperation = 'divide';
DivideExpression.getId = DivideExpression.mathOperation;

DivideExpression.build = function( string ) {
    
    var expressionList = arithmethicHelper.build( 
            string,
            DivideExpression.mathOperation 
    );

    return new DivideExpression( string, expressionList );
};

module.exports = DivideExpression;

},{"../../context.js":20,"../expressionsUtils.js":41,"./arithmethicHelper.js":22}],24:[function(_dereq_,module,exports){
/*
    ModExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var arithmethicHelper = _dereq_( './arithmethicHelper.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );

var ModExpression = function( stringToApply, expressionListToApply ) {
    
    var string = stringToApply;
    var expressionList = expressionListToApply;
    
    var evaluate = function( scope ){

        return arithmethicHelper.evaluate( 
            string,
            scope,
            expressionList, 
            ModExpression.mathOperation, 
            function( total, value ){
                return total % value;
            } 
        );
    };
    
    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, expressionList );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

ModExpression.removePrefix = true;
ModExpression.getPrefix = function() {
    return context.getConf().modExpression;
};
ModExpression.mathOperation = 'mod';
ModExpression.getId = ModExpression.mathOperation;

ModExpression.build = function( string ) {
    
    var expressionList = arithmethicHelper.build( 
            string,
            ModExpression.mathOperation 
    );

    return new ModExpression( string, expressionList );
};

module.exports = ModExpression;

},{"../../context.js":20,"../expressionsUtils.js":41,"./arithmethicHelper.js":22}],25:[function(_dereq_,module,exports){
/*
    MultiplyExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var arithmethicHelper = _dereq_( './arithmethicHelper.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );

var MultiplyExpression = function( stringToApply, expressionListToApply ) {
    
    var string = stringToApply;
    var expressionList = expressionListToApply;
    
    var evaluate = function( scope ){

        return arithmethicHelper.evaluate( 
            string,
            scope,
            expressionList, 
            MultiplyExpression.mathOperation, 
            function( total, value ){
                return total * value;
            } 
        );
    };

    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, expressionList );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

MultiplyExpression.removePrefix = true;
MultiplyExpression.getPrefix = function() {
    return context.getConf().mulExpression;
};
MultiplyExpression.mathOperation = 'multiply';
MultiplyExpression.getId = MultiplyExpression.mathOperation;

MultiplyExpression.build = function( string ) {
    
    var expressionList = arithmethicHelper.build( 
            string,
            MultiplyExpression.mathOperation 
    );

    return new MultiplyExpression( string, expressionList );
};

module.exports = MultiplyExpression;

},{"../../context.js":20,"../expressionsUtils.js":41,"./arithmethicHelper.js":22}],26:[function(_dereq_,module,exports){
/*
    SubstractExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var arithmethicHelper = _dereq_( './arithmethicHelper.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );

var SubstractExpression = function( stringToApply, expressionListToApply ) {
    
    var string = stringToApply;
    var expressionList = expressionListToApply;
    
    var evaluate = function( scope ){

        return arithmethicHelper.evaluate( 
            string,
            scope,
            expressionList, 
            SubstractExpression.mathOperation, 
            function( total, value ){
                return total - value;
            } 
        );
    };
    
    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, expressionList );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

SubstractExpression.removePrefix = true;
SubstractExpression.getPrefix = function() {
    return context.getConf().subExpression;
};
SubstractExpression.mathOperation = 'substract';
SubstractExpression.getId = SubstractExpression.mathOperation;

SubstractExpression.build = function( string ) {
    
    var expressionList = arithmethicHelper.build( 
            string,
            SubstractExpression.mathOperation 
    );

    return new SubstractExpression( string, expressionList );
};

module.exports = SubstractExpression;

},{"../../context.js":20,"../expressionsUtils.js":41,"./arithmethicHelper.js":22}],27:[function(_dereq_,module,exports){
/*
    AndExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var evaluateHelper = _dereq_( '../evaluateHelper.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );

var AndExpression = function( stringToApply, expressionListToApply ) {
    
    var string = stringToApply;
    var expressionList = expressionListToApply;
    
    var evaluate = function( scope ){

        for ( var i = 0; i < expressionList.length; i++ ) {
            var expression = expressionList[ i ];
            if ( ! evaluateHelper.evaluateBoolean( scope, expression ) ){
                return false;
            }
        }

        return true;
    };
    
    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, expressionList );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

AndExpression.removePrefix = true;
AndExpression.getPrefix = function() {
    return context.getConf().andExpression;
};
AndExpression.getId = AndExpression.getPrefix;

AndExpression.build = function( string ) {
    var boolHelper = _dereq_( './boolHelper.js' );
    
    var expressionList = boolHelper.build( string, 'And' );

    return new AndExpression( string, expressionList );
};

module.exports = AndExpression;

},{"../../context.js":20,"../evaluateHelper.js":37,"../expressionsUtils.js":41,"./boolHelper.js":28}],28:[function(_dereq_,module,exports){
/* 
    boolHelper singleton class
*/
"use strict";

module.exports = (function() {    
    var context = _dereq_( '../../context.js' );
    var ExpressionTokenizer = _dereq_( '../expressionTokenizer.js' );
    var expressionBuilder = _dereq_( '../expressionBuilder.js' );
    
    var build = function( s, tag ) {
        
        var string = s.trim();
        
        if ( string.length === 0 ) {
            throw tag + ' expression void.';
        }

        var segments = new ExpressionTokenizer( 
                string, 
                context.getConf().expressionDelimiter, 
                false );
        if ( segments.countTokens() === 1 ) {
            throw 'Syntax error in expression "' + string + '". Only one element in ' + tag + ' expression, please add at least one more.';
        }
        
        return expressionBuilder.buildList( segments );
    };
    
    return {
        build: build
    };
})();

},{"../../context.js":20,"../expressionBuilder.js":39,"../expressionTokenizer.js":40}],29:[function(_dereq_,module,exports){
/*
    CondExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var ExpressionTokenizer = _dereq_( '../expressionTokenizer.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );
var evaluateHelper = _dereq_( '../evaluateHelper.js' );

var CondExpression = function( stringToApply, expression1ToApply, expression2ToApply, expression3ToApply ) {
    
    var string = stringToApply;
    var expression1 = expression1ToApply;
    var expression2 = expression2ToApply;
    var expression3 = expression3ToApply;
    
    var evaluate = function( scope ){
        
        return evaluateHelper.evaluateBoolean( scope, expression1 )?
            expression2.evaluate( scope ):
            expression3.evaluate( scope );
    };
    
    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, expression1, expression2, expression3 );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

CondExpression.removePrefix = true;
CondExpression.getPrefix = function() {
    return context.getConf().condExpression;
};
CondExpression.getId = CondExpression.getPrefix;

CondExpression.build = function( s ) {
    var expressionBuilder = _dereq_( '../expressionBuilder.js' );
    
    var string = s.trim();

    if ( string.length === 0 ) {
        throw 'Cond expression void.';
    }

    var segments = new ExpressionTokenizer( 
            string, 
            context.getConf().expressionDelimiter, 
            false );
    if ( segments.countTokens() !== 3 ) {
        throw 'Syntax error in cond expression "' + string + '". 3 element are needed.';
    }

    return new CondExpression( 
        string,
        expressionBuilder.build( segments.nextToken() ), 
        expressionBuilder.build( segments.nextToken() ), 
        expressionBuilder.build( segments.nextToken() ) 
    );
};

module.exports = CondExpression;

},{"../../context.js":20,"../evaluateHelper.js":37,"../expressionBuilder.js":39,"../expressionTokenizer.js":40,"../expressionsUtils.js":41}],30:[function(_dereq_,module,exports){
/*
    NotExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var evaluateHelper = _dereq_( '../evaluateHelper.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );

var NotExpression = function( stringToApply, expressionToApply ) {
    
    var string = stringToApply;
    var expression = expressionToApply;
    
    var evaluate = function( scope ){
        return ! evaluateHelper.evaluateBoolean( scope, expression );
    };

    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, expression );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

NotExpression.removePrefix = true;
NotExpression.getPrefix = function() {
    return context.getConf().notExpression;
};
NotExpression.getId = NotExpression.getPrefix;

NotExpression.build = function( string ) {
    var expressionBuilder = _dereq_( '../expressionBuilder.js' );
    
    var expression = expressionBuilder.build( string );
    
    return new NotExpression( string, expression );
};

module.exports = NotExpression;

},{"../../context.js":20,"../evaluateHelper.js":37,"../expressionBuilder.js":39,"../expressionsUtils.js":41}],31:[function(_dereq_,module,exports){
/*
    OrExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var evaluateHelper = _dereq_( '../evaluateHelper.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );

var OrExpression = function( stringToApply, expressionListToApply ) {
    
    var string = stringToApply;
    var expressionList = expressionListToApply;
    
    var evaluate = function( scope ){

        for ( var i = 0; i < expressionList.length; i++ ) {
            var expression = expressionList[ i ];
            if ( evaluateHelper.evaluateBoolean( scope, expression ) ){
                return true;
            }
        }

        return false;
    };

    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, expressionList );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

OrExpression.removePrefix = true;
OrExpression.getPrefix = function() {
    return context.getConf().orExpression;
};
OrExpression.getId = OrExpression.getPrefix;

OrExpression.build = function( string ) {
    var boolHelper = _dereq_( './boolHelper.js' );
    
    var expressionList = boolHelper.build( string, 'Or' );

    return new OrExpression( string, expressionList );
};

module.exports = OrExpression;

},{"../../context.js":20,"../evaluateHelper.js":37,"../expressionsUtils.js":41,"./boolHelper.js":28}],32:[function(_dereq_,module,exports){
/* 
    comparisonHelper singleton class
*/
"use strict";

module.exports = (function() {
    var context = _dereq_( '../../context.js' );
    var ExpressionTokenizer = _dereq_( '../expressionTokenizer.js' );
    var evaluateHelper = _dereq_( '../evaluateHelper.js' );
    
    var build = function( s, tag ) {
        var expressionBuilder = _dereq_( '../expressionBuilder.js' );
        
        var string = s.trim();
        
        if ( string.length === 0 ) {
            throw tag + ' expression void.';
        }

        var segments = new ExpressionTokenizer( 
                string, 
                context.getConf().expressionDelimiter, 
                false );
        if ( segments.countTokens() !== 2 ) {
            throw 'Wrong number of elements in expression "' + string + '", ' + tag + ' expressions only support two.';
        }

        var expression1 = expressionBuilder.build( segments.nextToken() );
        var expression2 = expressionBuilder.build( segments.nextToken() );
        
        return {
            expression1: expression1,
            expression2: expression2
        };
    };
    
    var evaluate = function( scope, valueExpression1, valueExpression2 ) {
        
        return {
            number1: evaluateHelper.evaluateNumber( scope, valueExpression1 ),
            number2: evaluateHelper.evaluateNumber( scope, valueExpression2 )
        };
    };
    
    return {
        build: build,
        evaluate: evaluate
    };
})();

},{"../../context.js":20,"../evaluateHelper.js":37,"../expressionBuilder.js":39,"../expressionTokenizer.js":40}],33:[function(_dereq_,module,exports){
/*
    EqualsExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var ExpressionTokenizer = _dereq_( '../expressionTokenizer.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );

var EqualsExpression = function( stringToApply, argsToApply ) {
    
    var string = stringToApply;
    var args = argsToApply;
    
    var evaluate = function( scope ){
        var arg0 = args[ 0 ];
        var result0 = arg0.evaluate( scope );
        
        for ( var i = 1; i < args.length; i++ ) {
            var arg = args[ i ];
            var result = arg.evaluate( scope );
            if ( result0 != result ){
                return false;
            }
        }
        
        return true;
    };

    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, args );
    };
    
    var toString = function(){
        return string;
    };

    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

EqualsExpression.removePrefix = true;
EqualsExpression.getPrefix = function() {
    return context.getConf().equalsExpression;
};
EqualsExpression.getId = EqualsExpression.getPrefix;

EqualsExpression.build = function( s ) {
    var expressionBuilder = _dereq_( '../expressionBuilder.js' );
    
    var string = s.trim();
    
    if ( string.length === 0 ) {
        throw 'Equals expression void.';
    }

    var segments = new ExpressionTokenizer( 
            string, 
            context.getConf().expressionDelimiter, 
            false );
    if ( segments.countTokens() === 1 ) {
        throw 'Only one element in equals expression "' + string + '", please add at least one more.';
    }

    return new EqualsExpression( 
        string,
        expressionBuilder.buildList( segments ) 
    );
};

module.exports = EqualsExpression;

},{"../../context.js":20,"../expressionBuilder.js":39,"../expressionTokenizer.js":40,"../expressionsUtils.js":41}],34:[function(_dereq_,module,exports){
/*
    GreaterExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var comparisonHelper = _dereq_( './comparisonHelper.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );

var GreaterExpression = function( stringToApply, expression1ToApply, expression2ToApply ) {
    
    var string = stringToApply;
    var expression1 = expression1ToApply;
    var expression2 = expression2ToApply;
    
    var evaluate = function( scope ){
        var numbers = comparisonHelper.evaluate( scope, expression1, expression2 );
        return numbers.number1 > numbers.number2;
    };

    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, expression1, expression2 );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

GreaterExpression.removePrefix = true;
GreaterExpression.getPrefix = function() {
    return context.getConf().greaterExpression;
};
GreaterExpression.getId = GreaterExpression.getPrefix;

GreaterExpression.build = function( string ) {
    
    var data = comparisonHelper.build( string, 'greater' );

    return new GreaterExpression( string, data.expression1, data.expression2 );
};

module.exports = GreaterExpression;

},{"../../context.js":20,"../expressionsUtils.js":41,"./comparisonHelper.js":32}],35:[function(_dereq_,module,exports){
/*
    InExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var ExpressionTokenizer = _dereq_( '../expressionTokenizer.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );

var InExpression = function( stringToApply, expressionListToApply ) {
    
    var string = stringToApply;
    var expressionList = expressionListToApply;
    
    var evaluate = function( scope ){
        var expression0 = expressionList[ 0 ];
        var evaluated0 = expression0.evaluate( scope );
        
        for ( var i = 1; i < expressionList.length; i++ ) {
            var expression = expressionList[ i ];
            var evaluated = expression.evaluate( scope );
            
            if ( Array.isArray( evaluated ) ){ 
                for ( var j = 0; j < evaluated.length; j++ ) {
                    if ( evaluated0 == evaluated[ j ] ){
                        return true;
                    }
                }
                continue;
            }
            
            if ( evaluated0 == evaluated ){
                return true;
            }
        }
        
        return false;
    };

    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, expressionList );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

InExpression.removePrefix = true;
InExpression.getPrefix = function() {
    return context.getConf().inExpression;
};
InExpression.getId = InExpression.getPrefix;

InExpression.build = function( s ) {
    var expressionBuilder = _dereq_( '../expressionBuilder.js' );
    
    var string = s.trim();
    
    if ( string.length === 0 ) {
        throw 'In expression void.';
    }

    var segments = new ExpressionTokenizer( 
            string, 
            context.getConf().expressionDelimiter, 
            false 
    );
    if ( segments.countTokens() === 1 ) {
        throw 'Only one element in in expression "' + string + '", please add at least one more.';
    }

    return new InExpression( 
        string,
        expressionBuilder.buildList( segments ) 
    );
};

module.exports = InExpression;

},{"../../context.js":20,"../expressionBuilder.js":39,"../expressionTokenizer.js":40,"../expressionsUtils.js":41}],36:[function(_dereq_,module,exports){
/*
    LowerExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var comparisonHelper = _dereq_( './comparisonHelper.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );

var LowerExpression = function( stringToApply, expression1ToApply, expression2ToApply ) {
    
    var string = stringToApply;
    var expression1 = expression1ToApply;
    var expression2 = expression2ToApply;
    
    var evaluate = function( scope ){
        var numbers = comparisonHelper.evaluate( scope, expression1, expression2 );
        return numbers.number1 < numbers.number2;
    };
    
    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, expression1, expression2 );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

LowerExpression.removePrefix = true;
LowerExpression.getPrefix = function() {
    return context.getConf().lowerExpression;
};
LowerExpression.getId = LowerExpression.getPrefix;

LowerExpression.build = function( string ) {
    
    var data = comparisonHelper.build( string, 'lower' );

    return new LowerExpression( string, data.expression1, data.expression2 );
};

module.exports = LowerExpression;

},{"../../context.js":20,"../expressionsUtils.js":41,"./comparisonHelper.js":32}],37:[function(_dereq_,module,exports){
/* 
    evaluateHelper singleton class
*/
"use strict";

var context = _dereq_( '../context.js' );

module.exports = (function() {
    
    var evaluateToNotNull = function( scope, expression ) {
        var evaluated = expression.evaluate( scope );
        return evaluated == undefined? 'undefined': evaluated;
    };
    
    var evaluateBoolean = function( scope, expression ) {
        var evaluated = expression.evaluate( scope );
        
        if ( evaluated === undefined
            || evaluated == null
            || evaluated == 'false' 
            || evaluated == false 
            || evaluated == 0 ){
            return false;
        }
        
        return true;
    };
    
    var evaluateNumber = function( scope, expression, errorMessageToApply ) {
        var evaluated = expression.evaluate( scope );
        
        if ( ! isNumber( evaluated ) ){
            var errorMessage = 
                errorMessageToApply? 
                errorMessageToApply: 
                'Expression "' + expression + '" is not a valid number.';
            throw errorMessage;
        }
        
        return evaluated;
    };
    
    var isNumber = function( string ){
        return ! isNaN( parseFloat( string ) ) || ! isFinite( string );
    };
    /*
    var evaluateInteger = function( scope, expression, errorMessageToApply ) {
        var evaluated = expression.evaluate( scope );
        
        if ( ! isInteger( evaluated ) ){
            var errorMessage = 
                errorMessageToApply? 
                errorMessageToApply: 
                'Expression "' + expression + '" is not a valid integer.'
            throw errorMessage;
        }
        
        return evaluated;
    };*/
    /*
    var isInteger = function( string ){
        return ! isNaN( parseInt( string ) ) || ! isFinite( string );
    };*/
    
    var evaluateExpressionList = function ( list, scope ){
        
        var result = [];
        
        for ( var i = 0; i < list.length; i++ ) {
            var expression = list[ i ];
            result.push( expression.evaluate( scope ) );
        }
        
        return result;
    };
    
    var isDefault = function( value ){
        return value === context.getConf().defaultVarValue;
    };
    var isNothing = function( value ){
        return value === context.getConf().nothingVarValue;
    };
    
    return {
        evaluateToNotNull: evaluateToNotNull,
        evaluateBoolean: evaluateBoolean,
        evaluateNumber: evaluateNumber,
        //evaluateInteger: evaluateInteger,
        isNumber: isNumber,
        //isInteger: isInteger,
        evaluateExpressionList: evaluateExpressionList,
        isDefault: isDefault,
        isNothing: isNothing
    };
})();

},{"../context.js":20}],38:[function(_dereq_,module,exports){
/*
    ExistsExpression class
*/
"use strict";

var context = _dereq_( '../context.js' );
var expressionsUtils = _dereq_( './expressionsUtils.js' );

var ExistsExpression = function( stringToApply, expressionToApply ) {
    
    var string = stringToApply;
    var expression = expressionToApply;
    
    var evaluate = function( scope ){
        
        try {
            return undefined !== expression.evaluate( scope );
            
        } catch ( e ){
            return false;
        }
    };

    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, expression );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

ExistsExpression.removePrefix = true;
ExistsExpression.getPrefix = function() {
    return context.getConf().existsExpression;
};
ExistsExpression.getId = ExistsExpression.getPrefix;

ExistsExpression.build = function( string ) {
    var expressionBuilder = _dereq_( './expressionBuilder.js' );
    
    var expression = expressionBuilder.build( string );
    return new ExistsExpression( string, expression );
};

module.exports = ExistsExpression;

},{"../context.js":20,"./expressionBuilder.js":39,"./expressionsUtils.js":41}],39:[function(_dereq_,module,exports){
/* 
    expressionBuilder singleton class
*/
module.exports = (function() {
    "use strict";
    
    var context = _dereq_( '../context.js' );
    var ExpressionTokenizer = _dereq_( './expressionTokenizer.js' );
    var PathExpression = _dereq_( './path/pathExpression.js' );
    var expressionCache = _dereq_( '../cache/expressionCache.js' );
    /*var log = require( '../logHelper.js' );*/
    
    var expressionManagers = {};
    var withoutPrefixExpressionManagers = {};
    var DEFAULT_ID = PathExpression.getId();
    
    /* Register expression managers */
    var register = function( expressionsManager, id ) {
        expressionManagers[ id || expressionsManager.getPrefix() || expressionsManager.getId() ] = expressionsManager;
        
        if ( ! expressionsManager.removePrefix && expressionsManager.getPrefix() ){
            withoutPrefixExpressionManagers[ expressionsManager.getPrefix() ] = expressionsManager;
        }
    };
    
    var unregister = function( expressionsManager, id ) {
        delete expressionManagers[ id || expressionsManager.getPrefix() || expressionsManager.getId() ];
    };
    
    var registerGeneralPurpose = function(){
        register( _dereq_( './existsExpression.js' ) );
        register( _dereq_( './formatExpression.js' ) );
        register( _dereq_( './stringExpression.js' ) );
        register( _dereq_( './path/pathExpression.js' ) );
    };
    var registerComparison = function(){
        register( _dereq_( './comparison/equalsExpression.js' ) );
        register( _dereq_( './comparison/greaterExpression.js' ) );
        register( _dereq_( './comparison/lowerExpression.js' ) );
        register( _dereq_( './comparison/inExpression.js' ) );
    };
    var registerArithmetic = function(){
        register( _dereq_( './arithmethic/addExpression.js' ) );
        register( _dereq_( './arithmethic/substractExpression.js' ) );
        register( _dereq_( './arithmethic/multiplyExpression.js' ) );
        register( _dereq_( './arithmethic/divideExpression.js' ) );
        register( _dereq_( './arithmethic/modExpression.js' ) );
    };
    var registerLogical = function(){
        register( _dereq_( './bool/andExpression.js' ) );
        register( _dereq_( './bool/condExpression.js' ) );
        register( _dereq_( './bool/notExpression.js' ) );
        register( _dereq_( './bool/orExpression.js' ) );
    };
    var registerI18n = function(){
        register( _dereq_( './i18n/trCurrencyExpression.js' ) );
        register( _dereq_( './i18n/trDateTimeExpression.js' ) );
        register( _dereq_( './i18n/trNumberExpression.js' ) );
        register( _dereq_( './i18n/trStringExpression.js' ) );
    };
    var registerScripting = function(){
        register( _dereq_( './scripting/javascriptExpression.js' ) );
        register( _dereq_( './scripting/queryExpression.js' ) );
    };
    
    var registerAll = function(){
        registerGeneralPurpose();
        registerComparison();
        registerArithmetic();
        registerLogical();
        registerI18n();
        registerScripting();
    }();
    /* End Register expression managers */
    
    var build = function( string, force ) {
        return expressionCache.get(
                string, 
                function(){
                    return forceBuild( string );
                }, 
                force
        );
    };
    
    var forceBuild = function( string ) {
        var effectiveString = removeParenthesisIfAny( string.trim() );
        var index = effectiveString.indexOf( context.getConf().expressionSuffix );
        var id = undefined;
        var isDefault = false;
        
        // Is the default expression type? Is registered?
        if ( index !== -1 ){
            id = effectiveString.substring( 0, index )  + ':';
            
            // If the id is not resistered must be a path
            isDefault = ! expressionManagers.hasOwnProperty( id );
        } else {
            isDefault = true;
        }
        
        // Remove prefix and set id if it is default expression type
        var removePrefix = false;
        var expressionManager = undefined;
        if ( isDefault ){
            /*id = DEFAULT_ID;*/
            expressionManager = getWithoutPrefixExpressionManager( effectiveString );
        } else {
            removePrefix = true;
        }
        
        // Get the expression manager and build the expression
        expressionManager = expressionManager || expressionManagers[ id ];
        var finalString = undefined;
        if ( removePrefix && expressionManager.removePrefix ){
            finalString = effectiveString.substr( id.length );
        } else {
            finalString = effectiveString;
        }
        return expressionManager.build( finalString );
    };
    
    var getWithoutPrefixExpressionManager = function( string ){
        
        for ( var prefix in withoutPrefixExpressionManagers ) {
            if ( string.indexOf( prefix ) === 0 ) {
                return withoutPrefixExpressionManagers[ prefix ];
            }
        }
        
        return expressionManagers[ DEFAULT_ID ];
    };
    
    var buildList = function( segments ) {
        var list = [];
        
        while ( segments.hasMoreTokens() ) {
            list.push(
                build( 
                    segments.nextToken().trim()  ) );
        }

        return list;
    };
    
    var removePrefix = function( string, prefix ) {
        return string.substr( prefix.length );
    };
    
    var removePrefixAndBuild = function( string, prefix ) {
        return build(
                string.substr( prefix.length ));
    };
    
    var removeParenthesisIfAny = function( token ){
        var effectiveToken = token.trim();
        
        if ( effectiveToken == '' ){
            return effectiveToken;
        }
        
        if ( effectiveToken.charAt( 0 ) === '(' ){
            return removeParenthesisIfAny( 
                        effectiveToken.substring( 1, effectiveToken.lastIndexOf( ')' ) ).trim() );
        }
        
        return effectiveToken;
    };
    
    var endsWith = function( str, suffix ) {
        return str.indexOf( suffix, str.length - suffix.length ) !== -1;
    };
    
    var getArgumentsFromString = function( string ) {
        
        // Parse and evaluate arguments; then push them to an array
        var tokens = new ExpressionTokenizer( 
                string, 
                context.getConf().argumentsDelimiter, 
                true );
        var args = [];
        while ( tokens.hasMoreTokens() ) {
            var currentString = tokens.nextToken().trim();
            args.push( 
                    build( currentString ) );
        }
        
        return args;
    };
    
    return {
        register: register,
        unregister: unregister,
        registerAll: registerAll,
        build: build,
        buildList: buildList,
        removePrefix: removePrefix,
        removePrefixAndBuild: removePrefixAndBuild,
        removeParenthesisIfAny: removeParenthesisIfAny,
        endsWith: endsWith,
        getArgumentsFromString: getArgumentsFromString
    };
})();

},{"../cache/expressionCache.js":19,"../context.js":20,"./arithmethic/addExpression.js":21,"./arithmethic/divideExpression.js":23,"./arithmethic/modExpression.js":24,"./arithmethic/multiplyExpression.js":25,"./arithmethic/substractExpression.js":26,"./bool/andExpression.js":27,"./bool/condExpression.js":29,"./bool/notExpression.js":30,"./bool/orExpression.js":31,"./comparison/equalsExpression.js":33,"./comparison/greaterExpression.js":34,"./comparison/inExpression.js":35,"./comparison/lowerExpression.js":36,"./existsExpression.js":38,"./expressionTokenizer.js":40,"./formatExpression.js":42,"./i18n/trCurrencyExpression.js":43,"./i18n/trDateTimeExpression.js":44,"./i18n/trNumberExpression.js":46,"./i18n/trStringExpression.js":47,"./path/pathExpression.js":56,"./scripting/javascriptExpression.js":61,"./scripting/queryExpression.js":62,"./stringExpression.js":63}],40:[function(_dereq_,module,exports){
/* 
    Class ExpressionTokenizer 
*/
module.exports = function( exp, delimiter, escape ) {
    "use strict";
    
    var expressionBuilder = _dereq_( './expressionBuilder.js' );
    var removeParenthesisIfAny = expressionBuilder.removeParenthesisIfAny;
    
    var expression = exp.trim();

    var iterator;
    var currIndex = 0;
    var delimiterCount = 0;
    var delimiters = [];
    
    var makeIterator = function( array ){
        var nextIndex = 0;
        
        return {
            next: function(){
                return nextIndex < array.length ?
                   array [ nextIndex++ ] :
                   undefined;
            },
            hasNext: function(){
                return nextIndex < array.length;
            }
        };
    };
    
    var analyze = function(){
        var avoidRepeatedSeparators = delimiter === ' ';
        
        // Go ahead and find delimiters, if any, at construction time
        var parentLevel = 0;
        var inQuote = false;
        var previousCh = '';
        
        // Scan for delimiters
        var length = expression.length;
        for ( var i = 0; i < length; i++ ) {
            var ch = expression.charAt( i );
            
            if ( ch === delimiter ) {
                // If delimiter is not buried in parentheses or a quote
                if ( parentLevel === 0 && ! inQuote  ) {
                    
                    if ( avoidRepeatedSeparators && ( previousCh === delimiter || previousCh === '\n' ) ) {
                        continue;
                    }
                    
                    var nextCh = ( i + 1 < length ) ? expression.charAt( i + 1 ) : '';
                    
                    // And if delimiter is not escaped
                    if ( ! ( escape && nextCh === delimiter ) ) {
                        delimiterCount++;
                        delimiters.push( i );
                    } else {
                        // Somewhat inefficient way to pare the
                        // escaped delimiter down to a single
                        // character without breaking our stride
                        expression = expression.substring( 0, i + 1 ) + expression.substring( i + 2 );
                        length--;
                    }
                }
            // Increment parenthesis level
            } else if ( ch === '(' || ch === '[' ) {
                parentLevel++;
                
            // Decrement parenthesis level
            } else if ( ch === ')' || ch === ']' ) {
                parentLevel--;
                // If unmatched right parenthesis
                if ( parentLevel < 0 ) {
                    throw 'Syntax error. Unmatched right parenthesis: ' + expression;
                }
                
            // Start or end quote
            } else if ( ch === '\'' ) {
                inQuote = ! inQuote;
            }
            
            previousCh = ch;
        }
        
        // If unmatched left parenthesis
        if ( parentLevel > 0 ) {
            throw 'Syntax error: unmatched left parenthesis: ' + expression;
        }
        
        // If runaway quote
        if ( inQuote ) {
            throw 'Syntax error: runaway quotation: ' + expression;
        }
        
        iterator = makeIterator( delimiters );
    }();
    
    var hasMoreTokens = function( ) {
        return currIndex < expression.length;
    };
    
    var nextToken = function( ) {
        var token;
        
        if ( iterator.hasNext() ) {
            var next = iterator.next();
            var delim = parseInt( next );
            token = expression.substring( currIndex, delim ).trim();
            currIndex = delim + 1;
            delimiterCount--;
            
            return removeParenthesisIfAny( token );
        }
        
        token = expression.substring( currIndex ).trim();
        currIndex = expression.length;
        
        return removeParenthesisIfAny( token );
    };
        
    var countTokens = function( ) {
        if ( hasMoreTokens() ) {
            return delimiterCount + 1;
        }
        return 0;
    };
    
    var nextTokenIfAny = function( defaultValue ) {
        return hasMoreTokens()? nextToken(): defaultValue;
    };
    
    return {
        hasMoreTokens: hasMoreTokens,
        nextToken: nextToken,
        countTokens: countTokens,
        nextTokenIfAny: nextTokenIfAny
    };
};

},{"./expressionBuilder.js":39}],41:[function(_dereq_,module,exports){
/* 
    expressionsUtils singleton class
*/
"use strict";

var evaluateHelper = _dereq_( './evaluateHelper.js' );
var utils = _dereq_( '../utils.js' );
var DepsDataItem = _dereq_( '../parsers/depsDataItem.js' );

module.exports = (function() {
    
    var buildLiteral = function( value ) {
        return evaluateHelper.isNumber( value )? "" + value: "'" + value + "'";
    };
    
    var buildList = function( items, asStrings ) {
        
        var result = '[';
        var separator = asStrings? "'": "";
        
        for ( var i = 0; i < items.length; i++ ) {
            result += separator + items[ i ] + separator + " ";
        }
        
        result += ']';
        return result;
    };
    
    var buildDependsOnList = function(){
        
        var result = [];
        
        var depsDataItem = arguments[ 0 ];
        if ( ! depsDataItem ){
            depsDataItem = new DepsDataItem();
        }
        
        var scope = arguments[ 1 ];
        
        for ( var argCounter = 2; argCounter < arguments.length; argCounter++ ){
            var list = arguments[ argCounter ];
            result = result.concat( 
                getDependsOnFromList( depsDataItem, scope, list )
            );
        }
        
        return result;
    };
    
    var getDependsOnFromList = function( depsDataItem, scope, arg ){
        
        var result = [];
        
        if ( ! arg ){
            return result;
        }
        
        if ( ! Array.isArray( arg ) ){
            return getDependsOnFromNonList( depsDataItem, scope, arg );
        }
        
        var list = arg;
        for ( var i = 0; i < list.length; i++ ) {
            var item = list[ i ];
            result = result.concat( 
                Array.isArray( item )? getDependsOnFromList( scope, item ): getDependsOnFromNonList( depsDataItem, scope, item )
            );
        }

        return result;
    };
    
    var getDependsOnFromNonList = function( depsDataItem, scope, item ){
        
        return ! utils.isFunction( item.dependsOn ) || ( utils.isFunction( item.getVarName ) && depsDataItem === item.getVarName() )? 
            []: 
            item.dependsOn( depsDataItem, scope );
    };
    
    return {
        buildLiteral: buildLiteral,
        buildList: buildList,
        buildDependsOnList: buildDependsOnList
    };
})();

},{"../parsers/depsDataItem.js":70,"../utils.js":94,"./evaluateHelper.js":37}],42:[function(_dereq_,module,exports){
/*
    FormatExpression class
*/
"use strict";

var utils = _dereq_( '../utils.js' );
var context = _dereq_( '../context.js' );
var ExpressionTokenizer = _dereq_( './expressionTokenizer.js' );
var expressionsUtils = _dereq_( './expressionsUtils.js' );
var evaluateHelper = _dereq_( './evaluateHelper.js' );

var FormatExpression = function( stringToApply, formatterExpressionToApply, argsExpressionsToApply ) {
    
    var string = stringToApply;
    var formatterExpression = formatterExpressionToApply;
    var argsExpressions = argsExpressionsToApply;
    
    var evaluate = function( scope ){
        
        // Get formatter
        var formatter = evaluateFormatter( scope, formatterExpression );
        
        // Get arguments
        var args = evaluateHelper.evaluateExpressionList( argsExpressions, scope );
        
        return formatter.apply( formatter, args );
    };
    
    var evaluateFormatter = function( scope, expression ) {
        
        // Try to get a built-in formatter
        var formatter = context.getFormatter( expression );
        
        // Try to get a function with a name
        if ( ! isValidFormatter( formatter ) ){
            formatter = scope.get( expression );
        }
    
        // Try to get a function evaluating the expression
        if ( ! isValidFormatter( formatter ) ){
            try {
                var expressionBuilder = _dereq_( './expressionBuilder.js' );
                var formatterExpression = expressionBuilder.build( expression );
                var value = formatterExpression.evaluate( scope );
                
                return evaluateFormatter( scope, value );

            } catch( e ){
                // Nothing to do
            }
        }
        
        // Return the formatter only if it is valid
        if ( isValidFormatter( formatter ) ){
            return formatter;
        }
        
        throw 'No valid formatter found: ' + string;
    };
    
    var isValidFormatter = function( formatter ){
        return formatter && utils.isFunction( formatter );
    };
    
    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, formatterExpression, argsExpressions );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

FormatExpression.removePrefix = true;
FormatExpression.getPrefix = function() {
    return context.getConf().formatExpression;
};
FormatExpression.getId = FormatExpression.getPrefix;

FormatExpression.build = function( s ) {
    var expressionBuilder = _dereq_( './expressionBuilder.js' );
    
    var string = s.trim();
    if ( string.length === 0 ) {
        throw 'Format expression void.';
    }

    var segments = new ExpressionTokenizer( 
            string, 
            context.getConf().expressionDelimiter, 
            false );
    var numberOfTokens = segments.countTokens();
    if ( numberOfTokens === 1 ) {
        throw 'Only one element in format expression: "' + string + '". Please add at least one more.';
    }

    // Get formatter
    var formatter = segments.nextToken().trim();

    // Get arguments
    var argsExpressions = [];
    while ( segments.hasMoreTokens() ) {
        var argExpression = expressionBuilder.build( segments.nextToken() );
        argsExpressions.push( argExpression );
    }

    return new FormatExpression( string, formatter, argsExpressions );
};

module.exports = FormatExpression;

},{"../context.js":20,"../utils.js":94,"./evaluateHelper.js":37,"./expressionBuilder.js":39,"./expressionTokenizer.js":40,"./expressionsUtils.js":41}],43:[function(_dereq_,module,exports){
/*
    TrCurrencyExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var trHelper = _dereq_( './trHelper.js' );

var TrCurrencyExpression = function( stringToApply, expressionToApply, argsExpressionsToApply, subformatToApply ) {
    
    var string = stringToApply;
    var expression = expressionToApply;
    var argsExpressions = argsExpressionsToApply;
    var subformat = subformatToApply;
    
    var evaluate = function( scope ){
        var evaluated = trHelper.evaluate( 
                scope, 
                expression, 
                argsExpressions, 
                'currency', 
                subformat );
        return evaluated;
    };
    
    var dependsOn = function( depsDataItem, scope ){
        return trHelper.dependsOn( depsDataItem, scope, expression, argsExpressions );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

TrCurrencyExpression.removePrefix = true;
TrCurrencyExpression.getPrefix = function() {
    return context.getConf().trCurrencyExpression;
};
TrCurrencyExpression.getId = TrCurrencyExpression.getPrefix;

TrCurrencyExpression.build = function( string ) {
    
    var trData = trHelper.build( 
            string,
            TrCurrencyExpression.getPrefix(), 
            2, 
            3, 
            true );

    return new TrCurrencyExpression( 
            string, 
            trData.expression, 
            trData.argsExpressions, 
            trData.subformat );
};

module.exports = TrCurrencyExpression;

},{"../../context.js":20,"./trHelper.js":45}],44:[function(_dereq_,module,exports){
/*
    TrDateTimeExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var trHelper = _dereq_( './trHelper.js' );

var TrDateTimeExpression = function( stringToApply, expressionToApply, argsExpressionsToApply ) {
    
    var string = stringToApply;
    var expression = expressionToApply;
    var argsExpressions = argsExpressionsToApply;
    
    var evaluate = function( scope ){
        var evaluated = trHelper.evaluate( 
                scope, 
                expression, 
                argsExpressions, 
                'datetime', 
                null );
        return evaluated;
    };

    var dependsOn = function( depsDataItem, scope ){
        return trHelper.dependsOn( depsDataItem, scope, expression, argsExpressions );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

TrDateTimeExpression.removePrefix = true;
TrDateTimeExpression.getPrefix = function() {
    return context.getConf().trDateTimeExpression;
};
TrDateTimeExpression.getId = TrDateTimeExpression.getPrefix;

TrDateTimeExpression.build = function( string ) {
    
    var trData = trHelper.build( 
            string,
            TrDateTimeExpression.getPrefix(), 
            1, 
            2, 
            false );

    return new TrDateTimeExpression( 
            string, 
            trData.expression, 
            trData.argsExpressions );
};

module.exports = TrDateTimeExpression;

},{"../../context.js":20,"./trHelper.js":45}],45:[function(_dereq_,module,exports){
/* 
    trHelper singleton class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var ExpressionTokenizer = _dereq_( '../expressionTokenizer.js' );
var i18nHelper = _dereq_( '../../i18n/i18nHelper.js' );
var evaluateHelper = _dereq_( '../evaluateHelper.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );
var VariableExpression = _dereq_( '../path/variableExpression.js' );

module.exports = (function() {
    
    var build = function( string, tag, minElements, maxElements, useSubformat ) {
        var expressionBuilder = _dereq_( '../expressionBuilder.js' );
        
        if ( string.length === 0 ) {
            throw tag + ' expression void.';
        }

        var segments = new ExpressionTokenizer( 
                string.trim(), 
                context.getConf().expressionDelimiter, 
                false );
        
        // Check number of tokens
        var count = segments.countTokens();
        if ( count < minElements ) {
            throw 'Too few elements in ' + tag + ' expression (minimum is ' + minElements 
                    + ', ' + count + ' present): ' + string.trim();
        }
        if ( count > maxElements ) {
            throw 'Too many elements in ' + tag + ' expression (maximum is ' + maxElements 
                    + ', ' + count + ' present):' + string.trim();
        }
        
        // Get tokens
        var subformat = useSubformat? 
                expressionBuilder.build( segments.nextToken() ): 
                undefined;
        var expression = expressionBuilder.build( 
                segments.nextToken().trim() );
        var argsSegment = segments.hasMoreTokens()? 
                segments.nextToken().trim(): 
                undefined;
        
        return {
            expression: expression,
            argsExpressions: buildI18nArgs( argsSegment ),
            subformat: subformat
        };
    };
    
    var buildI18nArgs = function( segment ){
        var expressionBuilder = _dereq_( '../expressionBuilder.js' );
        
        var args = {};
        if ( ! segment ){
            return args;
        }
        var tokens = new ExpressionTokenizer( 
                segment, 
                context.getConf().i18nOptionsDelimiter, 
                true
        );
        while ( tokens.hasMoreTokens() ) {
            var token = tokens.nextToken().trim();
            var argsTokens = new ExpressionTokenizer( 
                    token, 
                    context.getConf().inI18nOptionsDelimiter, 
                    true 
            );
            if ( argsTokens.countTokens() !== 2 ) {
                throw '2 elements are needed in i18n expression.';
            }
            
            var argKey = argsTokens.nextToken().trim();
            var argExpression = expressionBuilder.build( 
                    argsTokens.nextToken().trim() );
            args[ argKey ] = argExpression;
        }
        return args;
    };
    
    var evaluateI18nArgs = function( scope, i18nArgs ){
        var values = {};
        
        for ( var argKey in i18nArgs ) {
            var argExpression = i18nArgs[ argKey ];
            var argValue = evaluateHelper.evaluateToNotNull( scope, argExpression );
            values[ argKey ] = argValue;
        }
        
        return values;
    };
    
    var evaluate = function( scope, valueExpression, argsExpressions, format, subformat ) {
        var argValues = evaluateI18nArgs( scope, argsExpressions );
        var subformatEvaluated = 
                subformat? 
                evaluateHelper.evaluateToNotNull( scope, subformat ): 
                undefined;
        var valueEvaluated = evaluateHelper.evaluateToNotNull( scope, valueExpression );
        var evaluated = translate( 
                scope, 
                valueEvaluated, 
                argValues, 
                format, 
                subformatEvaluated );
        
        return evaluated;
    };
    
    var translate = function( scope, id, i18nArgs, format, subformat ){
        
        var i18nList = scope.get( context.getConf().i18nDomainVarName );
        var language = scope.get( context.getConf().i18nLanguageVarName );
        return i18nHelper.tr( 
            i18nList, 
            id, 
            i18nArgs, 
            format, 
            subformat,
            language 
        );
    };
    
    var dependsOn = function( depsDataItem, scope, expression, argsExpressions ){
        
        return expressionsUtils.buildDependsOnList( 
            depsDataItem, 
            scope, 
            new VariableExpression( context.getConf().i18nDomainVarName ),
            new VariableExpression( context.getConf().i18nLanguageVarName ),
            expression, 
            argsExpressions
        );
    };
    
    return {
        build: build,
        evaluate: evaluate,
        dependsOn: dependsOn
    };
})();

},{"../../context.js":20,"../../i18n/i18nHelper.js":66,"../evaluateHelper.js":37,"../expressionBuilder.js":39,"../expressionTokenizer.js":40,"../expressionsUtils.js":41,"../path/variableExpression.js":60}],46:[function(_dereq_,module,exports){
/*
    TrNumberExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var trHelper = _dereq_( './trHelper.js' );

var TrNumberExpression = function( stringToApply, expressionToApply, argsExpressionsToApply ) {
    
    var string = stringToApply;
    var expression = expressionToApply;
    var argsExpressions = argsExpressionsToApply;
    
    var evaluate = function( scope ){
        var evaluated = trHelper.evaluate( 
                scope, 
                expression, 
                argsExpressions, 
                'number', 
                null 
        );
        return evaluated;
    };

    var dependsOn = function( depsDataItem, scope ){
        return trHelper.dependsOn( depsDataItem, scope, expression, argsExpressions );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

TrNumberExpression.removePrefix = true;
TrNumberExpression.getPrefix = function() {
    return context.getConf().trNumberExpression;
};
TrNumberExpression.getId = TrNumberExpression.getPrefix;

TrNumberExpression.build = function( string ) {
    
    var trData = trHelper.build( 
            string,
            TrNumberExpression.getPrefix(), 
            1, 
            2, 
            false 
    );

    return new TrNumberExpression( 
            string, 
            trData.expression, 
            trData.argsExpressions 
    );
};

module.exports = TrNumberExpression;

},{"../../context.js":20,"./trHelper.js":45}],47:[function(_dereq_,module,exports){
/*
    TrStringExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var trHelper = _dereq_( './trHelper.js' );

var TrStringExpression = function( stringToApply, expressionToApply, argsExpressionsToApply ) {
    
    var string = stringToApply;
    var expression = expressionToApply;
    var argsExpressions = argsExpressionsToApply;
    
    var evaluate = function( scope ){
        var evaluated = trHelper.evaluate( 
                scope, 
                expression, 
                argsExpressions, 
                'string', 
                null 
        );
        return evaluated;
    };
    
    var dependsOn = function( depsDataItem, scope ){
        return trHelper.dependsOn( depsDataItem, scope, expression, argsExpressions );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

TrStringExpression.removePrefix = true;
TrStringExpression.getPrefix = function() {
    return context.getConf().trExpression;
};
TrStringExpression.getId = TrStringExpression.getPrefix;

TrStringExpression.build = function( string ) {
    
    var trData = trHelper.build( 
            string,
            TrStringExpression.getPrefix(), 
            1, 
            2, 
            false 
    );

    return new TrStringExpression( 
            string, 
            trData.expression, 
            trData.argsExpressions 
    );
};

module.exports = TrStringExpression;

},{"../../context.js":20,"./trHelper.js":45}],48:[function(_dereq_,module,exports){
/*
    ArrayExpression class
*/
"use strict";

var expressionsUtils = _dereq_( '../expressionsUtils.js' );

var ArrayExpression = function( arrayBaseToApply, indexesToApply ) {
    
    var arrayBase = arrayBaseToApply;
    var indexes = indexesToApply;
    
    var evaluate = function( scope ){
        
        // Evaluate and check array bases and indexes
        var evaluatedArrayBase = arrayBase.evaluate( scope );

        // Iterate indexes
        var result = evaluatedArrayBase;
        for ( var i = 0; i < indexes.length; i++ ) {
            
            // Get and evaluate index as integer
            var indexExpression = indexes[ i ];

            // Evaluate array access
            result = result[ indexExpression.evaluate( scope ) ];
        }
        
        return result;
    };
    
    var dependsOn = function( depsDataItem, scope ){
        
        // Build the arrayBaseDependsOn
        var arrayBaseDependsOn = expressionsUtils.buildDependsOnList( depsDataItem, scope, arrayBase );
        
        // This must be rare!
        if ( arrayBaseDependsOn.length === 0 ){
            return [];
        } else if ( arrayBaseDependsOn.length > 1 ){
            return expressionsUtils.buildDependsOnList( depsDataItem, scope, arrayBase, indexes );
        }
        
        // Join all together
        var dep = arrayBaseDependsOn[ 0 ];
        for ( var i = 0; i < indexes.length; ++i ){
            var indexExpression = indexes[ i ];
            var indexEvaluated = indexExpression.evaluate( scope );
            dep += '[' + indexEvaluated + ']';
        }
        
        return [ dep ];
    };
    
    var toString = function(){
        return arrayBase + '[' + indexes + ']';
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

ArrayExpression.build = function( arrayBase, accessor ) {
    var expressionBuilder = _dereq_( '../expressionBuilder.js' );
    
    var indexes = [];
    
    var done = false;
    while ( ! done ){

        // Array accessor must begin and end with brackets
        var close = accessor.indexOf( ']' );
        if ( accessor.charAt( 0 ) !== '[' || close === -1 ) {
            throw 'Bad array accessor: '  + accessor;
        }

        // Get index and add to indexes
        var index = expressionBuilder.build( 
                accessor.substring( 1, close ) 
        );
        indexes.push( index );

        // continue processing array access for multidimensional arrays
        close++;
        if ( accessor.length > close ) {
            accessor = accessor.substring( close );
        } else {
            done = true;
        }
    }
    
    return new ArrayExpression( arrayBase, indexes );
};

ArrayExpression.buildArrayData = function( token ) {
    
    var bracket = ArrayExpression.findArrayAccessor( token );
    
    if ( bracket <= 0 ) {
        return undefined;
    }
    
    return {
        arrayAccessor: token.substring( bracket ).trim(),
        token: token.substring( 0, bracket ).trim()
    };
};

ArrayExpression.findArrayAccessor = function( token ) {
    var SCANNING = 0;
    var IN_PAREN = 1;
    var IN_QUOTE = 2;

    var length = token.length;
    var state = SCANNING;
    var parenDepth = 0;
    for ( var i = 0; i < length; i++ ) {
        var ch = token.charAt( i );
        switch( state ) {
        case IN_PAREN:
            if ( ch === ')' ) {
                parenDepth--;
                if ( parenDepth === 0 ) {
                    state = SCANNING;
                }
            } else if ( ch === '(' ) {
                parenDepth++;
            }
            break;

        case IN_QUOTE:
            if ( ch === '\'' ) {
                state = SCANNING;
            }
            break;

        case SCANNING:
            if ( ch === '\'' ) {
                state = IN_QUOTE;
            } else if ( ch === '(' ) {
                parenDepth++;
                state = IN_PAREN;
            } else if ( ch === '[' ) {
                return i;
            }
        }
    }

    return -1;
};

module.exports = ArrayExpression;

},{"../expressionBuilder.js":39,"../expressionsUtils.js":41}],49:[function(_dereq_,module,exports){
/*
    FunctionExpression class
*/
"use strict";

var evaluateHelper = _dereq_( '../evaluateHelper.js' );

var FunctionExpression = function( stringToApply, nameToApply, argsToApply ) {
    
    var string = stringToApply;
    var name = nameToApply;
    var args = argsToApply;
    
    var evaluate = function( scope ){
        var evaluatedArgs = evaluateHelper.evaluateExpressionList( args, scope );
        var element = scope.get( name );
        return ! element? undefined: element.apply( element, evaluatedArgs );
    };

    var dependsOn = function(){
        return [];
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

FunctionExpression.build = function( string ) {
    var expressionBuilder = _dereq_( '../expressionBuilder.js' );
    
    var leftParent = string.indexOf( '(' );
    if ( leftParent === -1 ) {
        return undefined;
    }
    
    if ( ! expressionBuilder.endsWith( string, ')' ) ) {
        throw 'Syntax error. Bad function call: ' + string;
    }
    var functionName = string.substring( 0, leftParent ).trim();
    var argsString = string.substring( leftParent + 1, string.length - 1 );
    var args = expressionBuilder.getArgumentsFromString( argsString );

    return new FunctionExpression( string, functionName, args );
};

module.exports = FunctionExpression;

},{"../evaluateHelper.js":37,"../expressionBuilder.js":39}],50:[function(_dereq_,module,exports){
/*
    IndirectionExpression class
*/
"use strict";

var IndirectionExpression = function( nameToApply ) {
    
    var name = nameToApply;
    
    var evaluate = function( scope, parent ){
        return parent[ scope.get( name ) ];
    };
    
    var dependsOn = function(){
        return [];
    };
    
    var toString = function(){
        return '?' + name;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

IndirectionExpression.build = function( string ) {
    
    if ( string.charAt( 0 ) !== '?' ) {
        return undefined;
    }
    
    return new IndirectionExpression( string.substring( 1 ) );
};

module.exports = IndirectionExpression;

},{}],51:[function(_dereq_,module,exports){
/*
    ListExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var ExpressionTokenizer = _dereq_( '../expressionTokenizer.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );
var RangeExpression = _dereq_( './rangeExpression.js' );

var ListExpression = function( stringToApply, itemsToApply ) {
    
    var string = stringToApply;
    var items = itemsToApply;
    
    var evaluate = function( scope ){
        
        var result = [];
        
        for ( var i = 0; i < items.length; i++ ) {
            var expression = items[ i ];
            var evaluated = expression.evaluate( scope );
            
            if ( Array.isArray( evaluated ) ){ 
                result = result.concat( evaluated );
            } else {
                result.push( evaluated );
            }
        }

        return result;
    };
    
    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, items );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

ListExpression.build = function( s ) {
    var expressionBuilder = _dereq_( '../expressionBuilder.js' );
    
    if ( s.charAt( 0 ) !== '[' || s.charAt( s.length - 1 ) !==  ']' ) {
        return undefined;
    }
    
    var string = s.substring( 1, s.length - 1 );
    var items = [];
    var segments = new ExpressionTokenizer( 
            string, 
            context.getConf().expressionDelimiter, 
            true );

    while ( segments.hasMoreTokens() ) {
        var segment = segments.nextToken().trim();
        var range = RangeExpression.build( segment );

        items.push(
            range?
            range:
            expressionBuilder.build( segment )
        );
    }

    return new ListExpression( string, items );
};

module.exports = ListExpression;

},{"../../context.js":20,"../expressionBuilder.js":39,"../expressionTokenizer.js":40,"../expressionsUtils.js":41,"./rangeExpression.js":59}],52:[function(_dereq_,module,exports){
/*
    BooleanLiteral class
*/
"use strict";

var BooleanLiteral = function( literalToApply ) {

    var literal = literalToApply;
    
    var evaluate = function( scope ){
        return literal;
    };
    
    var toString = function(){
        return "" + literal;
    };
    
    var dependsOn = function(){
        return [];
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

BooleanLiteral.build = function( string ) {
    
    if ( 'true' === string ) {
        return new BooleanLiteral( true );
    }
    if ( 'false' === string ) {
        return new BooleanLiteral( false );
    }
    return undefined;
};

module.exports = BooleanLiteral;

},{}],53:[function(_dereq_,module,exports){
/*
    NumericLiteral class
*/
"use strict";

var NumericLiteral = function( literalToApply ) {
    
    var literal = literalToApply;
    
    var evaluate = function( scope ){
        return literal;
    };
    
    var dependsOn = function(){
        return [];
    };
    
    var toString = function(){
        return literal;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

NumericLiteral.build = function( string ) {
    
    if ( isFinite( string ) ){
        var integerValue = parseInt( string );
        if ( integerValue == string ){
            return new NumericLiteral( integerValue );
        }

        var floatValue = parseFloat( string );
        if ( floatValue == string ){
            return new NumericLiteral( floatValue );
        }
    }

    return undefined;
};

module.exports = NumericLiteral;

},{}],54:[function(_dereq_,module,exports){
/*
    StringLiteral class
*/
"use strict";

var StringLiteral = function( literalToApply ) {

    var literal = literalToApply;
    
    var evaluate = function( scope ){
        return literal;
    };
    
    var dependsOn = function(){
        return [];
    };
    
    var toString = function(){
        return literal;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

StringLiteral.build = function( string ) {
    
    if ( string.charAt( 0 ) === "'" && string.charAt( string.length - 1 ) ===  "'" ) {
        return new StringLiteral( 
            string.substring( 1, string.length - 1 ) );
    }

    return undefined;
};

module.exports = StringLiteral;

},{}],55:[function(_dereq_,module,exports){
/*
    MethodExpression class
*/
"use strict";

var evaluateHelper = _dereq_( '../evaluateHelper.js' );

var MethodExpression = function( stringToApply, nameToApply, argsToApply ) {
    
    var string = stringToApply;
    var name = nameToApply;
    var args = argsToApply;
    
    var evaluate = function( scope, parent ){
        var evaluatedArgs = evaluateHelper.evaluateExpressionList( args, scope );
        return parent[ name ].apply( parent, evaluatedArgs );
    };

    var dependsOn = function(){
        return undefined;
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

MethodExpression.build = function( string ) {
    var expressionBuilder = _dereq_( '../expressionBuilder.js' );
    
    var leftParent = string.indexOf( '(' );
    if ( leftParent === -1 ) {
        return undefined;
    }
    
    if ( ! expressionBuilder.endsWith( string, ')' ) ) {
        throw 'Syntax error. Bad method call: ' + string;
    }
    
    var methodName = string.substring( 0, leftParent ).trim();
    var argsString = string.substring( leftParent + 1, string.length - 1 );
    var args = expressionBuilder.getArgumentsFromString( argsString );
    
    return new MethodExpression( string, methodName, args );
};

module.exports = MethodExpression;

},{"../evaluateHelper.js":37,"../expressionBuilder.js":39}],56:[function(_dereq_,module,exports){
/*
    PathExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var ExpressionTokenizer = _dereq_( '../expressionTokenizer.js' );
var StringLiteral = _dereq_( './literals/stringLiteral.js' );
var PathSegmentExpression = _dereq_( './pathSegmentExpression.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );

var PathExpression = function( stringToApply, expressionListToApply ) {
    
    var string = stringToApply;
    var expressionList = expressionListToApply;
    
    var evaluate = function( scope ){

        var exception = undefined;
        
        for ( var i = 0; i < expressionList.length; i++ ) {
            try {
                var expression = expressionList[ i ];
                var result = expression.evaluate( scope );
                if ( result != null ){
                    return result;
                }
            } catch( e ) {
                exception = e;
            }
        }
        
        if ( exception ) {
            throw exception;
        }
        
        return null;
    };

    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, expressionList );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

PathExpression.removePrefix = false;
PathExpression.getPrefix = function() {
    return context.getConf().pathExpression;
};
PathExpression.getId = function() { 
    return 'path';
};

PathExpression.build = function( s ) {
    var expressionBuilder = _dereq_( '../expressionBuilder.js' );
    
    var string = s.trim();
    
    // Blank expression evaluates to blank string
    if ( string.length === 0 ) {
        return StringLiteral.build( '' );
    }
    
    var segments = new ExpressionTokenizer( 
            string, 
            context.getConf().pathDelimiter, 
            false );

    // If there is only 1 must be a path segment
    if ( segments.countTokens() === 1 ) {
        return PathSegmentExpression.build( string );
    }

    // If there are more than 1 they can be any expression instance
    var expressionList = [];
    while ( segments.hasMoreTokens() ) {
        var nextToken = segments.nextToken();
        if ( ! nextToken ){
            throw 'Null token inside path expression: ' + string;
        }
        expressionList.push( 
            expressionBuilder.build( 
                nextToken
            ) 
        );
    }
    return new PathExpression( string, expressionList );
};

module.exports = PathExpression;

},{"../../context.js":20,"../expressionBuilder.js":39,"../expressionTokenizer.js":40,"../expressionsUtils.js":41,"./literals/stringLiteral.js":54,"./pathSegmentExpression.js":57}],57:[function(_dereq_,module,exports){
/*
    PathSegmentExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var ExpressionTokenizer = _dereq_( '../expressionTokenizer.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );
var ArrayExpression = _dereq_( './arrayExpression.js' );
var StringLiteral = _dereq_( './literals/stringLiteral.js' );
var NumericLiteral = _dereq_( './literals/numericLiteral.js' );
var BooleanLiteral = _dereq_( './literals/booleanLiteral.js' );
var ListExpression = _dereq_( './listExpression.js' );
var FunctionExpression = _dereq_( './functionExpression.js' );
var VariableExpression = _dereq_( './variableExpression.js' );
var IndirectionExpression = _dereq_( './indirectionExpression.js' );
var MethodExpression = _dereq_( './methodExpression.js' );
var PropertyExpression = _dereq_( './propertyExpression.js' );

var PathSegmentExpression = function( stringToApply, itemsToApply ) {
    
    var string = stringToApply;
    var items = itemsToApply;
    
    var evaluate = function( scope ){
        
        var token = items[ 0 ];
        var result = token.evaluate( scope );
        for ( var i = 1; i < items.length; i++ ) {
            // Only last element can be null
            if ( result == null ) {
                throw 'Error evaluating "' + string + '": "'  + token + '" is null';
            }
            token = items[ i ];
            result = token.evaluate( scope, result );
        }
        
        return result;
    };
    
    var dependsOn = function( depsDataItem, scope ){
        
        var firstSegmentDependsOn = expressionsUtils.buildDependsOnList( depsDataItem, scope, items[ 0 ] );
        if ( firstSegmentDependsOn.length === 0 ){
            return [];
        } else if ( firstSegmentDependsOn.length > 1 ){
            return firstSegmentDependsOn;
        }
        
        var temp = firstSegmentDependsOn[ 0 ];
        var result = [ temp ];
        for ( var i = 1; i < items.length; i++ ) {
            var token = items[ i ];
            var tokenDependsOn = token.dependsOn( temp );
            if ( ! tokenDependsOn ){
                break;
                //return temp;
            }
            
            temp += tokenDependsOn;
            result.push( temp );
        }
        
        return result;
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

PathSegmentExpression.build = function( string ) {
    
    var items = [];
    
    // Blank expression evaluates to blank string
    if ( string.length === 0 ) {
        items.push( 
            StringLiteral.build( '' ) );
        return items;
    }

    // Build first token
    var path = new ExpressionTokenizer( 
            string, 
            context.getConf().pathSegmentDelimiter, 
            false );
    var token = path.nextToken().trim();
    items.push(
            PathSegmentExpression.buildFirstPathToken( token ) );

    // Traverse the path
    while ( path.hasMoreTokens() ) {
        token = path.nextToken().trim();
        items.push(
            PathSegmentExpression.buildNextPathToken( token ) );
    }
    
    return new PathSegmentExpression( string, items );
};

PathSegmentExpression.buildFirstPathToken = function( t ){

    // Separate identifier from any array accessors
    var arrayData = ArrayExpression.buildArrayData( t );
    var arrayAccessor = arrayData? arrayData.arrayAccessor: undefined;
    var token = arrayData? arrayData.token: t;

    // First token must come from dictionary or be a literal

    // First see if it's a string literal
    var result = StringLiteral.build( token );

    // If it's not, try to see if it's a number
    if ( result === undefined ) {
        result = NumericLiteral.build( token );

        // Maybe it's a boolean literal
        if ( result === undefined ) {
            result = BooleanLiteral.build( token );

            // A list?
            if ( result === undefined ){
                result = ListExpression.build( token );

                // A function call?
                if ( result === undefined ) {
                    result = FunctionExpression.build( token );

                    // Must be an object in scope
                    if ( result === undefined ) {
                        result = VariableExpression.build( token );
                        
                        // Not recognized expression
                        if ( result === undefined ) {
                            throw 'Unknown expression: ' + token;
                        }
                    }
                }
            }
        }
    }

    if ( arrayAccessor !== undefined ) {
        result = ArrayExpression.build( result, arrayAccessor );
    }

    return result;
};

PathSegmentExpression.buildNextPathToken = function( t ){
    
    // Separate identifier from any array accessors
    var arrayData = ArrayExpression.buildArrayData( t );
    var arrayAccessor = arrayData? arrayData.arrayAccessor: undefined;
    var token = arrayData? arrayData.token: t;

    // Test for indirection
    var result = IndirectionExpression.build( token );
    
    // A method call?
    if ( result === undefined ) {
        result = MethodExpression.build( token );

        // A property
        if ( result === undefined ) {
            result = PropertyExpression.build( token );
        }
    }

    if ( arrayAccessor !== undefined ) {
        result = ArrayExpression.build( result, arrayAccessor );
    }

    return result;
};

module.exports = PathSegmentExpression;

},{"../../context.js":20,"../expressionTokenizer.js":40,"../expressionsUtils.js":41,"./arrayExpression.js":48,"./functionExpression.js":49,"./indirectionExpression.js":50,"./listExpression.js":51,"./literals/booleanLiteral.js":52,"./literals/numericLiteral.js":53,"./literals/stringLiteral.js":54,"./methodExpression.js":55,"./propertyExpression.js":58,"./variableExpression.js":60}],58:[function(_dereq_,module,exports){
/*
    PropertyExpression class
*/
"use strict";

var PropertyExpression = function( nameToApply ) {
    
    var name = nameToApply;
    
    var evaluate = function( scope, parent ){
        return parent[ name ];
    };
    
    var dependsOn = function( parent ){
        return '.' + name;
    };
    
    var toString = function(){
        return name;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

PropertyExpression.build = function( string ) {
    return new PropertyExpression( string );
};

module.exports = PropertyExpression;

},{}],59:[function(_dereq_,module,exports){
/*
    RangeExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var ExpressionTokenizer = _dereq_( '../expressionTokenizer.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );
var evaluateHelper = _dereq_( '../evaluateHelper.js' );
var NumericLiteral = _dereq_( './literals/numericLiteral.js' );

var RangeExpression = function( stringToApply, startExpressionToApply, endExpressionToApply, stepExpressionToApply ) {
    
    var string = stringToApply;
    var startExpression = startExpressionToApply;
    var endExpression = endExpressionToApply;
    var stepExpression = stepExpressionToApply;
    
    var evaluate = function( scope ){
        
        // Evaluate all expressions
        var start = evaluateHelper.evaluateNumber( scope, startExpression );
        var end = evaluateHelper.evaluateNumber( scope, endExpression );
        var step = evaluateHelper.evaluateNumber( scope, stepExpression );
        
        // The range is valid, evaluate it
        var result = [];
        var forward = step > 0; 
        
        var c = start;
        while( forward? c <= end: c >= end ){
            result.push( c );
            c += step;
        }
        
        return result;
    };

    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, startExpression, endExpression, stepExpression );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

RangeExpression.build = function( s ) {
    var expressionBuilder = _dereq_( '../expressionBuilder.js' );
    
    if ( ! s ) {
        return undefined;
    }

    var string = s.trim();
    
    // If it contains spaces it is not a valid range
    if ( string.indexOf( ' ' ) !== -1 ) {
        return undefined;
    }
    
    var segments = new ExpressionTokenizer( 
            string, 
            context.getConf().intervalDelimiter, 
            false );

    var numberOfTokens = segments.countTokens();
    if ( numberOfTokens !== 2 && numberOfTokens !== 3 ) {
        return undefined;
    }

    var RANGE_DEFAULT_START = 0;
    var RANGE_DEFAULT_STEP = 1;
    
    // Build start expression
    var start = segments.nextToken().trim();
    var startExpression = start == ''? 
            NumericLiteral.build( RANGE_DEFAULT_START ): 
            expressionBuilder.build( start );

    // Build end expression
    var endExpression = expressionBuilder.build( segments.nextToken() );

    // Build step expression
    var stepExpression = numberOfTokens === 3? 
            expressionBuilder.build( segments.nextToken() ):
            NumericLiteral.build( RANGE_DEFAULT_STEP );
    
    return new RangeExpression( string, startExpression, endExpression, stepExpression );
};

module.exports = RangeExpression;

},{"../../context.js":20,"../evaluateHelper.js":37,"../expressionBuilder.js":39,"../expressionTokenizer.js":40,"../expressionsUtils.js":41,"./literals/numericLiteral.js":53}],60:[function(_dereq_,module,exports){
/*
    VariableExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );

var VariableExpression = function( nameToApply ) {
    
    var name = nameToApply;
    
    var evaluate = function( scope ){
        
        if ( ! scope.isValidVariable( name ) ){
            throw 'Not declared variable found using strict mode:' + name;
        }
        
        return scope.get( name );
    };
    
    var dependsOn = function( depsDataItem, scope ){
        
        if ( ! depsDataItem.mustAddVar( name ) ){
            return [];
        }
        
        var expression = scope.getVarExpression( name );
        if ( ! expression ){
            depsDataItem.add1NonExpressionVar( name );
            return [ name ];
        }
        
        depsDataItem.add1ExpressionVar( name );
        var result = expression.dependsOn( depsDataItem, scope );
        depsDataItem.addAllVars( result, scope );
        return result;
    };
    
    var getVarName = function(){
        return name;
    };
    
    var toString = function(){
        return name;
    };

    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        getVarName: getVarName,
        toString: toString
    };
};

VariableExpression.build = function( string ) {
    
    return context.getConf().variableNameRE.test( string )?
        new VariableExpression( string ):
        undefined;
};

module.exports = VariableExpression;

},{"../../context.js":20}],61:[function(_dereq_,module,exports){
/*
    JavascriptExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );
var StringExpression = _dereq_( '../stringExpression.js' );

var JavascriptExpression = function( expressionToApply ) {
    
    var stringExpression = expressionToApply;
    
    var evaluate = function( scope ){
        var evaluatedString = stringExpression.evaluate( scope );
        return eval( evaluatedString );
    };
    
    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, stringExpression );
    };
    
    var toString = function(){
        return stringExpression;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

JavascriptExpression.removePrefix = true;

JavascriptExpression.getPrefix = function() {
    if ( JavascriptExpression.prefix === undefined ){
        JavascriptExpression.prefix = context.getConf().javaScriptExpression;
    }
    return JavascriptExpression.prefix;
};

JavascriptExpression.getId = JavascriptExpression.getPrefix;

JavascriptExpression.build = function( string ) {
    return new JavascriptExpression(
            StringExpression.build( string ) );
};

module.exports = JavascriptExpression;

},{"../../context.js":20,"../expressionsUtils.js":41,"../stringExpression.js":63}],62:[function(_dereq_,module,exports){
/*
    QueryExpression class
*/
"use strict";

var context = _dereq_( '../../context.js' );
var expressionsUtils = _dereq_( '../expressionsUtils.js' );

var QueryExpression = function( stringToApply, expressionToApply ) {
    
    var string = stringToApply;
    var expression = expressionToApply;
    
    var evaluate = function( scope ){
        
        try {
            var evaluated = expression.evaluate( scope );
            var elementList = window.document.querySelectorAll( evaluated );
            
            // elementList with length 1
            if ( elementList.length === 1 ){
                return elementList[ 0 ].innerText;
            }
            
            // elementList with length > 1
            var texts = [];
            for ( var i = 0; i < elementList.length; ++i ){
                texts.push( elementList[ i ].innerText );
            }
            return texts;
            
        } catch ( e ){
            return 'Query expression error in "' + string + '": ' + e;
        }
    };

    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, expression );
    };
    
    var toString = function(){
        return string;
    };

    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

QueryExpression.removePrefix = true;
QueryExpression.getPrefix = function() {
    return context.getConf().queryExpression;
};
QueryExpression.getId = QueryExpression.getPrefix;

QueryExpression.build = function( string ) {
    var expressionBuilder = _dereq_( '../expressionBuilder.js' );
    
    var expression = expressionBuilder.build( string );
    
    return new QueryExpression( string, expression );
};

module.exports = QueryExpression;

},{"../../context.js":20,"../expressionBuilder.js":39,"../expressionsUtils.js":41}],63:[function(_dereq_,module,exports){
/*
    StringExpression class
*/
"use strict";

var context = _dereq_( '../context.js' );
var StringLiteral = _dereq_( './path/literals/stringLiteral.js' );
var PathExpression = _dereq_( './path/pathExpression.js' );
var expressionsUtils = _dereq_( './expressionsUtils.js' );

var StringExpression = function( stringToApply, expressionListToApply ) {
    
    var string = stringToApply;
    var expressionList = expressionListToApply;
    
    var evaluate = function( scope ){
        
        var result = '';
        
        for ( var i = 0; i < expressionList.length; i++ ) {
            var expression = expressionList[ i ];
            result += expression.evaluate( scope );
        }
        
        return result;
    };

    var dependsOn = function( depsDataItem, scope ){
        return expressionsUtils.buildDependsOnList( depsDataItem, scope, expressionList );
    };
    
    var toString = function(){
        return string;
    };
    
    return {
        evaluate: evaluate,
        dependsOn: dependsOn,
        toString: toString
    };
};

StringExpression.removePrefix = true;
StringExpression.getPrefix = function() {
    return context.getConf().stringExpression;
};
StringExpression.getId = StringExpression.getPrefix;

StringExpression.build = function( string ) {
    var STATE_SCANNING = 0;
    var STATE_AT_DOLLAR = 1;
    var STATE_IN_EXPRESSION = 2;
    var STATE_IN_BRACKETED_EXPRESSION = 3;

    var expressionList = [];
    var literal = '';
    var subexpression = '';
    var state = STATE_SCANNING;

    for ( var i = 0; i < string.length; i++ ) {
        var ch = string.charAt( i );

        switch ( state ) {
                
        // In the string part of the expression
        case STATE_SCANNING:
            // Found a dollar sign
            if ( ch === '$' ) {
                state = STATE_AT_DOLLAR;
                
            // Just keep appending to buffer
            } else {
                literal += ch;
            }
            break;

        // Next character after dollar sign
        case STATE_AT_DOLLAR:
            // An escaped dollar sign
            if ( ch === '$' ) {
                literal += '$';
                state = STATE_SCANNING;
                
            // Beginning of a bracketed expression
            } else if ( ch === '{' ) {
                // Reset subexpression and change state
                subexpression = '';
                state = STATE_IN_BRACKETED_EXPRESSION;

                // Add literal and reset it if needed
                if ( literal ){
                    expressionList.push( 
                            new StringLiteral( literal ) 
                    );
                    literal = '';
                }
                
            // Beginning of a non bracketed expression
            } else {
                subexpression += ch;
                state = STATE_IN_EXPRESSION;
                
                // Add literal and reset it if needed
                if ( literal ){
                    expressionList.push( 
                            new StringLiteral( literal )
                    );
                    literal = '';
                }
            }
            break;

        // In subexpression
        case STATE_IN_BRACKETED_EXPRESSION:
        case STATE_IN_EXPRESSION:
            // Check for end
            if ( ( state === STATE_IN_BRACKETED_EXPRESSION && ch === '}' )
                    || ( state === STATE_IN_EXPRESSION && ch == ' ' ) ) {
                expressionList.push( 
                        PathExpression.build( subexpression ) 
                );

                if ( state === STATE_IN_EXPRESSION ) {
                    literal += ch;
                }
                state = STATE_SCANNING;
                
            // Keep appending to subexpression
            } else {
                subexpression += ch;
            }
        }
    }

    // Ended in unclosed bracket
    if ( state === STATE_IN_BRACKETED_EXPRESSION ) {
        throw 'Unclosed left curly brace: ' + string;
        
    // Ended at expression
    } else if ( state == STATE_IN_EXPRESSION ) {
        expressionList.push( 
                PathExpression.build( subexpression ) 
        );
    }

    if ( literal ){
        expressionList.push( 
                new StringLiteral( literal ) 
        );
    }

    return new StringExpression( string, expressionList );
};

module.exports = StringExpression;

},{"../context.js":20,"./expressionsUtils.js":41,"./path/literals/stringLiteral.js":54,"./path/pathExpression.js":56}],64:[function(_dereq_,module,exports){
/* 
    I18n class 
    External dependencies: Intl (supported by recent browsers) and MessageFormat
*/
module.exports = function( languageId, res ) {
    "use strict";
    
    var MessageFormat = _dereq_( 'messageformat' );
    var context = _dereq_( '../context.js' );
    var utils = _dereq_( '../utils.js' );
    
    var resources = res;
    var mf = new MessageFormat( languageId );
    var cache = {};
    var numberFormatCache = {};
    var dateTimeFormatCache = {};
    /*var CONF_RESOURCE_ID = '/CONF/';*/
    var CONF_RESOURCE_ID = context.getConf().i18nConfResourceId;
    
    var getLanguage = function(){
        //return resources[ context.getConf().i18nConfResourceId ].language;
        return resources[ CONF_RESOURCE_ID ].language;
    };
    
    var getLocale = function(){
        //return resources[ context.getConf().i18nConfResourceId ].locale;
        return resources[ CONF_RESOURCE_ID ].locale;
    };
    
    var exists = function( id ) {
        return resources[ id ] !== undefined;
    };
    
    var tr = function( id, params, format, subformat ) {
        
        switch ( format ) {
        case 'string':
            return trString( id, params );
        case 'number':
            return trNumber( id, params );
        case 'currency':
            return trCurrency( id, params, subformat );
        case 'datetime':
            return trDateTime( id, params );
        } 
        
        throw 'I18n format type not supported: ' + format;
    };
    
    var trString = function( id, params ) {
        
        var mfunc = cache[ id ];
        
        if ( ! mfunc ){
            mfunc = mf.compile( resources[ id ] );
            cache[ id ] = mfunc;
        }
        
        return mfunc( params );
    };
    
    var getSource = function( params ){
        
        return params && utils.isFunction( params.toSource )?
            params.toSource():
            '';
    };
    
    var trNumber = function( value, params ) {
        
        var source = getSource( params );
        var numberFormat = numberFormatCache[ source ];
        
        if ( ! numberFormat ){
            numberFormat = new Intl.NumberFormat( getLocale(), params );
            numberFormatCache[ source ] = numberFormat;
        }
        
        return numberFormat.format( value );
    };
    
    var trCurrency = function( value, params, theCurrency ) {
        
        params.style = 'currency';
        params.currency = theCurrency;
        
        return trNumber( value, params );
    };
    
    var trDateTime = function( value, params ) {
        
        var source = getSource( params );
        var dateTimeFormat = dateTimeFormatCache[ source ];
        
        if ( ! dateTimeFormat ){
            dateTimeFormat = new Intl.DateTimeFormat( getLocale(), params );
            dateTimeFormatCache[ source ] = dateTimeFormat;
        }
        
        return dateTimeFormat.format( value );
    };
    
    return {
        getLanguage: getLanguage,
        getLocale: getLocale,
        exists: exists,
        tr: tr
    };
};

},{"../context.js":20,"../utils.js":94,"messageformat":98}],65:[function(_dereq_,module,exports){
/* 
    I18nBundle class 
*/
module.exports = function( ) {
    "use strict";
    
    var i18nList = {};
    var first = undefined;

    var add = function( i18n ){
        i18nList[ i18n.getLanguage() ] = i18n;
        if ( ! first ){
            first = i18n;
        }
    };
    
    var exists = function( id ){
        return first.exists( id );
    };
    
    var tr = function( id, params, format, subformat, language ) {
        
        if ( ! language ){
            throw 'Language not defined! Please, use data-iLanguage to define it before trying to translate anything!';
        }
        
        var i18n = i18nList[ language ];
        
        if ( ! i18n ){
            throw 'Language "' + language + '" not found in I18nBundle!';
        }
        
        return i18n.tr( id, params, format, subformat );
    };

    // Init!
    for ( var c = 0; c < arguments.length; c++ ) {
        add( arguments[ c ] );
    }
    
    return {
        add: add,
        exists: exists,
        tr: tr
    };
};

},{}],66:[function(_dereq_,module,exports){
/* 
    i18nHelper singleton class 
*/
var utils = _dereq_( '../utils.js' );
var I18n = _dereq_( './i18n.js' );
var context = _dereq_( '../context.js' );

module.exports = (function() {
    "use strict";
    
    var tr = function ( i18nList, id, params, format, subformat, language ){
        
        if ( ! i18nList ) {
            return 'No I18n instance defined!';
        }
            
        var length = i18nList.length;
        if ( ! length ){
            return 'Void I18n list!';
        }

        for ( var i = 0; i < length; i++ ) {
            var i18n = i18nList[ i ];
            if ( format !== 'string' || i18n.exists( id ) ){
                return i18n.tr( id, params, format, subformat, language );
            }
        }
        
        return 'I18n resource "' + id + '" not found!';
    };
    
    var loadAsync = function( remoteList, callback, failCallback ){
        
        loadAsyncItem( 
            {}, 
            callback, 
            failCallback,
            remoteList, 
            remoteList.length - 1 );
    };
    
    var loadAsyncItem = function( map, callback, failCallback, remoteList, currentIndex ){
        
        var url = remoteList[ currentIndex ];
        utils.getJSON( 
            {
                url: url,
                done: function( data ) {
                    map[ url ] = data;
                    if ( currentIndex > 0 ){
                        loadAsyncItem( 
                            map, 
                            callback, 
                            failCallback,
                            remoteList, 
                            --currentIndex );
                    } else {
                        callback( map );
                    }
                },
                fail: function( jqxhr, textStatus, error ) {
                    context.asyncError( url, error, failCallback );
                }
            }
        );
    };
    /*
    var loadAsyncItem = function( map, callback, failCallback, remoteList, currentIndex ){
        
        var url = remoteList[ currentIndex ];
        $.getJSON( url )
            .done(
                function( data ) {
                    map[ url ] = data;
                    if ( currentIndex > 0 ){
                        loadAsyncItem( 
                            map, 
                            callback, 
                            failCallback,
                            remoteList, 
                            --currentIndex );
                    } else {
                        callback( map );
                    }
                }
            )
            .fail(
                function( jqxhr, textStatus, error ) {
                    context.asyncError( url, error, failCallback );
                }
            );
    };
    */
    
    var loadAsyncAuto = function( dictionary, i18n, callback, failCallback ){
        
        // Return if it is nothing to do
        if ( ! i18n || ! i18n.files || ! Object.keys( i18n.files ).length ){
            callback();
            return;
        }
        
        // Build jsonFiles array
        var numberOfLanguages = Object.keys( i18n.files ).length;
        var jsonFiles = [];
        var urlPrefix = i18n.urlPrefix || '';
        for ( var lang in i18n.files ){
            var langFiles = i18n.files[ lang ];
            for ( var index in langFiles ){
                var file = langFiles[ index ];
                var url = urlPrefix + file;
                jsonFiles.push( url );
            }
        }
        
        // Use loadAsync method to load all jsonFiles; then register I18n instances and arrays
        loadAsync( 
            jsonFiles, 
            function( i18nMap ){
                
                for ( var lang in i18n.files ){
                    var langFiles = i18n.files[ lang ];
                    var i18nInstanceArray = [];
                    
                    // Register array vars
                    dictionary[ buildI18nInstanceArrayName( lang ) ] = i18nInstanceArray;
                    if ( numberOfLanguages === 1 ){
                        dictionary[ 'i18nArray' ] = i18nInstanceArray;
                    }
                    
                    for ( var index in langFiles ){
                        var file = langFiles[ index ];
                        var url = urlPrefix + file;
                        var i18nInstance = new I18n( lang, i18nMap[ url ] );
                        
                        // Register i18n instances
                        dictionary[ buildI18nInstanceName( file ) ] = i18nInstance;
                        i18nInstanceArray.unshift( i18nInstance ); // Add to the beginning of the array
                    }
                }
                
                callback();
            },
            failCallback 
        );
    };
    
    var buildI18nInstanceArrayName = function( lang ){
        return 'i18n' + lang.toUpperCase() + 'Array';
    };
    
    var buildI18nInstanceName = function( file ){
        
        var fileWithoutExtension = file.substr( 0, file.lastIndexOf( '.' ) );
        return 'i18n' + fileWithoutExtension.toUpperCase();
    };

    return {
        tr: tr,
        loadAsync: loadAsync,
        loadAsyncAuto: loadAsyncAuto
    };
})();

},{"../context.js":20,"../utils.js":94,"./i18n.js":64}],67:[function(_dereq_,module,exports){
/*
    logHelper singleton class
*/
module.exports = (function() {
    "use strict";
    
    var context = _dereq_( './context.js' );
    
    var trace = function (){
        
        var logger = context.getLogger();
        
        if ( ! logger ){
            return;
        }
        
        logger.trace.apply( logger, arguments );
    };
    
    var debug = function (){
        
        var logger = context.getLogger();
        
        if ( ! logger ){
            return;
        }
        
        logger.debug.apply( logger, arguments );
    };
    
    var info = function (){
        
        var logger = context.getLogger();
        
        if ( ! logger ){
            return;
        }
        
        logger.info.apply( logger, arguments );
    };
    
    var warn = function (){
        
        var logger = context.getLogger();
        
        if ( ! logger ){
            return;
        }
        
        logger.warn.apply( logger, arguments );
    };
    
    var error = function (){
        
        var logger = context.getLogger();
        
        if ( ! logger ){
            return;
        }
        
        logger.error.apply( logger, arguments );
    };
    
    var fatal = function (){
        
        var logger = context.getLogger();
        
        if ( ! logger ){
            return;
        }
        
        logger.fatal.apply( logger, arguments );
    };
    
    /*
    var fatalAndThrow = function ( message ){
        
        fatal.apply( this, arguments );
        throw message;
    };*/
    
    return {
        trace: trace,
        debug: debug,
        info: info,
        warn: warn,
        error: error,
        fatal: fatal
        //fatalAndThrow: fatalAndThrow
    };
})();

},{"./context.js":20}],68:[function(_dereq_,module,exports){
/*
    Exported functions
*/
exports.run = function( options ){
    
    var parser = _dereq_( './parsers/parser.js' );
    return parser.run( options );
};

/* Declare exports */
exports.I18n = _dereq_( './i18n/i18n.js' );
exports.I18nBundle = _dereq_( './i18n/i18nBundle.js' );
exports.i18nHelper = _dereq_( './i18n/i18nHelper.js' );
exports.context = _dereq_( './context.js' );
exports.logHelper = _dereq_( './logHelper.js' );
exports.expressionBuilder = _dereq_( './expressions/expressionBuilder.js' );
exports.evaluateHelper = _dereq_( './expressions/evaluateHelper.js' );
exports.ExpressionTokenizer = _dereq_( './expressions/expressionTokenizer.js' );
exports.ReactiveDictionary = _dereq_( './scopes/reactiveDictionary.js' );
exports.version = _dereq_( './version.js' );

/* Support RequireJS module pattern */
if ( typeof define === 'function' && define.amd ) {
    define( 'zpt.run', exports.run );
    define( 'zpt.I18n', exports.I18n );
    define( 'zpt.I18nBundle', exports.I18nBundle );
    define( 'zpt.i18nHelper', exports.i18nHelper );
    define( 'zpt.context', exports.context );
    define( 'zpt.logHelper', exports.logHelper );
    define( 'zpt.expressionBuilder', exports.expressionBuilder );
    define( 'zpt.evaluateHelper', exports.evaluateHelper );
    define( 'zpt.ExpressionTokenizer', exports.ExpressionTokenizer );
    define( 'zpt.ReactiveDictionary', exports.ReactiveDictionary );
    define( 'zpt.version', exports.version );
}

/* ES6 module suppoort */
global_zpt.run = exports.run;
global_zpt.I18n = exports.I18n;
global_zpt.I18nBundle = exports.I18nBundle;
global_zpt.i18nHelper = exports.i18nHelper;
global_zpt.context = exports.context;
global_zpt.logHelper = exports.logHelper;
global_zpt.expressionBuilder = exports.expressionBuilder;
global_zpt.evaluateHelper = exports.evaluateHelper;
global_zpt.ExpressionTokenizer = exports.ExpressionTokenizer;
global_zpt.ReactiveDictionary = exports.ReactiveDictionary;
global_zpt.version = exports.version;

var parser = _dereq_( './parsers/parser.js' );
global_zpt.getOptions = parser.getOptions; // Must add getOptions to exported functions

},{"./context.js":20,"./expressions/evaluateHelper.js":37,"./expressions/expressionBuilder.js":39,"./expressions/expressionTokenizer.js":40,"./i18n/i18n.js":64,"./i18n/i18nBundle.js":65,"./i18n/i18nHelper.js":66,"./logHelper.js":67,"./parsers/parser.js":85,"./scopes/reactiveDictionary.js":91,"./version.js":95}],69:[function(_dereq_,module,exports){
/* 
    Class AutoDefineHelper 
*/
var context = _dereq_( '../context.js' );
var TALDefine = _dereq_( '../attributes/TAL/talDefine.js' );

module.exports = function ( node ) {
    "use strict";
    
    var defineDelimiter = context.getConf().defineDelimiter;
    var inDefineDelimiter = context.getConf().inDefineDelimiter;
    var nocallExpressionPrefix = context.getConf().nocallVariableExpressionPrefix;
    var talAutoDefine = context.getTags().talAutoDefine;

    var buffer = '';
    if ( node && node.getAttribute( talAutoDefine ) ){
        buffer = node.getAttribute( talAutoDefine );
    }
    
    var put = function( name, string, nocall ){
        
        if ( buffer !== '' ){
            buffer += defineDelimiter;
        }
        buffer += (nocall? nocallExpressionPrefix + inDefineDelimiter: '') + name + inDefineDelimiter + string;
    };

    var updateNode = function( node ){

        if ( buffer ){
            node.setAttribute( talAutoDefine, buffer );
            return buffer;
        }
    };
    
    return {
        put: put,
        updateNode: updateNode
    };
};

},{"../attributes/TAL/talDefine.js":11,"../context.js":20}],70:[function(_dereq_,module,exports){
/* 
    Class DepsDataItem 
*/
"use strict";

var DepsDataItem = function() {
    
    this.nonExpressionVars = {};
    this.expressionVars = {};
};

DepsDataItem.prototype.mustAddVar = function( varName ){
    return this.nonExpressionVars[ varName ] === undefined && this.expressionVars[ varName ] === undefined;
};

DepsDataItem.prototype.addAllVars = function( varNames, scope ){
    
    for ( var name in varNames ){
        this.add1Var( varNames[ name ], scope );
    }
};

DepsDataItem.prototype.add1ExpressionVar = function( varName ){
    this.expressionVars[ varName ] = true;
};

DepsDataItem.prototype.add1NonExpressionVar = function( varName ){
    this.nonExpressionVars[ varName ] = true;
};

DepsDataItem.prototype.add1Var = function( varName, scope ){

    var map = scope.isLocalVar( varName )? this.expressionVars: this.nonExpressionVars;
    map[ varName ] = true;

    return true;
};

module.exports = DepsDataItem;

},{}],71:[function(_dereq_,module,exports){
/* 
    Class AbstractAction
*/
"use strict";

var utils = _dereq_( '../../utils.js' );
var context = _dereq_( '../../context.js' );

var AbstractAction = function( object, dictionary ) {
    
    this.id = object.id;
    this.var = object.var;
    this.currentElement = object.currentElement;
    this.animation = object.animation;
    this.animationCallback = object.animationCallback;
    if ( object.search ){
        if ( this.id || this.var ){
            throw 'Error in action: you can not set a search and then and id: if you set a search ZPT-JS will set the id for you!';
        }
        this.initializeUsingSearch( object.search, dictionary );
    }
};

AbstractAction.prototype.initializeUsingSearch = function( search, dictionary ){

    this.id = '';
    this.var = dictionary;
    
    // Iterate search items and build id and var
    for ( var i = 0; i < search.length; ++i ){
        var item = search[ i ];
        
        // Replace item is it a search object, '_first_' or '_last_'
        if ( utils.isPlainObject( item ) ){
            item = this.search( this.var, item );
        } else if ( item === context.getConf().firstIndexIdentifier ){
            item = 0;
        } else if ( item === context.getConf().lastIndexIdentifier ){
            item = this.var.length - 1;
        }
        
        // Build the id
        if ( Number.isInteger( item ) ){
            this.id += '[' + item + ']';
        } else {
            var separator = i === 0? '': '.';
            this.id += separator + item;
        }
        
        // Build the var
        this.var = this.var[ item ];
    }
};

AbstractAction.prototype.search = function( list, expressionElement ){
    
    for ( var i = 0; i < list.length; ++i ){
        var record = list[ i ];
        if ( AbstractAction.elementMaches( record, expressionElement ) ){
            return i;
        }
    }
    
    throw 'No record found matching your criteria!';
};

AbstractAction.elementMaches = function( element, expressionElement ){
    
    if ( expressionElement == undefined ){
        throw 'Expression to match must not be null!';
    }

    if ( Array.isArray( expressionElement ) ){
        throw 'Expression ' + utils.genericToString( expressionElement ) + ' to match must not be an array!';
    }

    if ( utils.isPlainObject( expressionElement ) ){
        for ( var i in expressionElement ){
            if ( expressionElement[ i ] !== element[ i ] ){
                return false;
            }
        }
        return true;
    }

    // Must be numeric or string
    return element === expressionElement;
};

AbstractAction.prototype.getValue = function( dictionary ){
    return this.var === undefined?
        dictionary[ this.id ]:
        this.var;
};

AbstractAction.prototype.resolveThisNode = function( indexItem, parserUpdater ){
    
    //var attributeInstance = indexItem.attributeInstance;
    var node = parserUpdater.findNodeById( indexItem.nodeId );
    if ( ! node ){
        // Removed node!
        parserUpdater.addRemovedToStatistics();
        return false;
    }
    parserUpdater.addUpdatedToStatistics();
    
    // Return the node
    return node;
};

AbstractAction.prototype.attributeInstanceIsRelated = function( attributeInstance ){
    throw 'Error: attributeInstanceIsRelated must be implemented!';
};

AbstractAction.prototype.updateDictionary = function(){
    throw 'Error: updateDictionary must be implemented!';
};

AbstractAction.prototype.updateHTML = function(){
    throw 'Error: updateHTML must be implemented!';
};

module.exports = AbstractAction;

},{"../../context.js":20,"../../utils.js":94}],72:[function(_dereq_,module,exports){
/* 
    Class AbstractArrayAction
*/
"use strict";

var AbstractAction = _dereq_( './abstractAction.js' );
var utils = _dereq_( '../../utils.js' );
var context = _dereq_( '../../context.js' );

var AbstractArrayAction = function( object, dictionary ) {
    AbstractAction.call( this, object, dictionary );
    
    this.index = object.index;
};

AbstractArrayAction.prototype = Object.create( AbstractAction.prototype );

AbstractArrayAction.getIndexNumericValue = function( index ){
    
    if ( index === undefined ){
        return undefined;   
    }
    
    if ( index === context.getConf().firstIndexIdentifier ){
        return 0;
    } else if ( index === context.getConf().lastIndexIdentifier ){
        return -1; // This means it is the last
    }
    return index;
};

AbstractArrayAction.prototype.getIndexNumericValue = function(){
    return AbstractArrayAction.getIndexNumericValue( this.index );
};

AbstractArrayAction.prototype.getIndexToUse = function( dictionary ){

    if ( this.index === undefined && this.currentElement === undefined ){
        throw 'index or currentElement must be defined in ' + this.id + ' array action!';
    }
    
    // Check if it uses the index
    var indexNumericValue = this.getIndexNumericValue();
    if ( indexNumericValue !== undefined ){
        return indexNumericValue;
    }

    // Must use currentElement
    var arrayValue = this.getValue( dictionary );
    
    for ( var i = 0; i < arrayValue.length; ++i ){
        var element = arrayValue[ i ];
        if ( AbstractAction.elementMaches( element, this.currentElement ) ){
            return i;
        }
    }
    
    throw 'currentElement ' + utils.genericToString( this.currentElement ) + ' not found in ' + this.id + ' array action!';
};

AbstractArrayAction.prototype.attributeInstanceIsRelated = function( attributeInstance ){
    return AbstractArrayAction.staticAttributeInstanceIsRelated( attributeInstance );
};

AbstractArrayAction.staticAttributeInstanceIsRelated = function( attributeInstance ){
    return attributeInstance.type === 'tal:repeat';
};

AbstractArrayAction.prototype.updateDictionary = function(){
    throw 'Error: updateDictionary must be implemented!';
};

AbstractArrayAction.prototype.updateHTML = function(){
    throw 'Error: updateHTML must be implemented!';
};

AbstractArrayAction.prototype.resolveChildNode = function( indexItem, parserUpdater ){
    
    //var attributeInstance = indexItem.attributeInstance;
    var node = parserUpdater.findNodeById( indexItem.nodeId );
    if ( ! node ){
        // Removed node!
        parserUpdater.addRemovedToStatistics();
        return false;
    }
    parserUpdater.addUpdatedToStatistics();
    
    // Return the node
    return this.indexToUse === -1?
        null:
        this.getIndexOfLoop( node.parentNode, indexItem.nodeId, this.indexToUse );
};

AbstractArrayAction.prototype.getIndexOfLoop = function( parentNode, nodeId, indexInLoop ){
    
    var numberOfChildren = parentNode.childElementCount;
    for ( var i = 0; i < numberOfChildren; ++i ){
        var childNode = parentNode.children[ i ];
        var currentNodeId = childNode.getAttribute( context.getTags().id );
        if ( currentNodeId === nodeId ){
            return parentNode.children[ 1 + i + indexInLoop ];
        }
    }
    
    return null;
};

module.exports = AbstractArrayAction;

},{"../../context.js":20,"../../utils.js":94,"./abstractAction.js":71}],73:[function(_dereq_,module,exports){
/* 
    Class AbstractObjectAction
*/
"use strict";

var AbstractAction = _dereq_( './abstractAction.js' );

var AbstractObjectAction = function( object, dictionary ) {
    AbstractAction.call( this, object, dictionary );
    
    this.property = object.property;
    this.id += '.' + object.property;
};

AbstractObjectAction.prototype = Object.create( AbstractAction.prototype );

AbstractObjectAction.prototype.attributeInstanceIsRelated = function( attributeInstance ){
    return true;
};

AbstractObjectAction.prototype.updateHTML = function( indexItem, parserUpdater, actionInstance ){
    
    // Must get the node
    var node = this.resolveThisNode( indexItem, parserUpdater );
    if ( ! node ){
        throw 'No node found to update';
    }
    
    // Update the selected node
    parserUpdater.updateNode( node );
    
    // Run animation
    parserUpdater.runAnimation( actionInstance, node );
    
    return true;
};

module.exports = AbstractObjectAction;

},{"./abstractAction.js":71}],74:[function(_dereq_,module,exports){
/* 
    Class ArrayCreate
*/
"use strict";

var AbstractArrayAction = _dereq_( './abstractArrayAction.js' );
var context = _dereq_( '../../context.js' );
var ParserNodeRenderer = _dereq_( '../../parsers/parserNodeRenderer.js' );
var utils = _dereq_( '../../utils.js' );

var ArrayCreate = function( object, dictionary ) {
    AbstractArrayAction.call( this, object, dictionary );
    
    this.newElement = object.newElement;
};

ArrayCreate.prototype = Object.create( AbstractArrayAction.prototype );

ArrayCreate.prototype.updateDictionary = function( dictionary ){
    
    this.indexToUse = this.getIndexToUse( dictionary );
    var arrayValue = this.getValue( dictionary );
    
    if ( this.indexToUse === -1 ){
        this.resolvedIndex = arrayValue.length;
        arrayValue.push( this.newElement );
    } else {
        this.resolvedIndex = this.indexToUse;
        arrayValue.splice( this.indexToUse, 0, this.newElement );
    }
};

ArrayCreate.prototype.updateHTML = function( indexItem, parserUpdater, actionInstance ){
    
    // Must get the nodeToUpdate
    var node = this.resolveThisNode( indexItem, parserUpdater );
    if ( ! node ){
        throw 'No node found to clone';
    }
    
    // Init some vars
    var tags = context.getTags();
    var parentNode = node.parentNode;
    
    // Clone and configure the node
    var tmpNode = ParserNodeRenderer.cloneAndConfigureNode( 
        node, 
        true, 
        tags, 
        node.getAttribute( tags.id ) 
    );
    ParserNodeRenderer.configureNodeForNewItem( 
        tmpNode, 
        tags, 
        parentNode, 
        indexItem, 
        this.resolvedIndex
    );
    
    // Insert it
    var sibling = this.indexToUse === -1?
        null:
        parentNode.children[ 1 + this.indexToUse ];
    parentNode.insertBefore( tmpNode, sibling );
    
    // Update the selected node
    parserUpdater.updateNode( tmpNode );
    
    // Run animation
    parserUpdater.runAnimation( actionInstance, tmpNode );
    
    return true;
};

ArrayCreate.buildMultiple = function( object, dictionary ){

    var actions = [];
    
    // Copy newElements to a new array
    var newElements = utils.copyArray( object.newElement );
    
    // Configure the object, create the first instance and add it to the list
    object.newElement = newElements[ 0 ];
    var firstActionInstance = new ArrayCreate( object, dictionary );
    actions.push( firstActionInstance );
    
    // Get the firstIndex and if the new elments must be the last
    var firstIndex = firstActionInstance.getIndexNumericValue();
    var isLast = -1 === firstIndex;
        
    // Build actions list
    for ( var i = 1; i < newElements.length; ++i ){
        var newElement = newElements[ i ];
        
        // Clone the object and configure the newElement and the index
        var newObject = utils.deepExtend( object );
        newObject.newElement = newElement;
        newObject.index = isLast?
            -1:
            firstIndex + i;
        
        // Instance the action instance and add it to the list
        var newActionInstance = new ArrayCreate( newObject, dictionary );
        actions.push( newActionInstance );
    }
    
    return actions;
};

module.exports = ArrayCreate;

},{"../../context.js":20,"../../parsers/parserNodeRenderer.js":86,"../../utils.js":94,"./abstractArrayAction.js":72}],75:[function(_dereq_,module,exports){
/* 
    Class ArrayDelete
*/
"use strict";

var AbstractArrayAction = _dereq_( './abstractArrayAction.js' );
var utils = _dereq_( '../../utils.js' );
var attributeIndex = _dereq_( '../../attributes/attributeIndex.js' );
var nodeRemover = _dereq_( '../nodeRemover.js' );

var ArrayDelete = function( object, dictionary ) {
    AbstractArrayAction.call( this, object, dictionary );
};

ArrayDelete.prototype = Object.create( AbstractArrayAction.prototype );

ArrayDelete.prototype.updateDictionary = function( dictionary ){

    this.indexToUse = this.getIndexToUse( dictionary );
    var arrayValue = this.getValue( dictionary );
    arrayValue.splice( this.indexToUse, 1 );
};

ArrayDelete.prototype.updateHTML = function( indexItem, parserUpdater, actionInstance, continueData ){
    
    // Must get the nodeToUpdate
    var nodeToDelete = this.resolveChildNode( indexItem, parserUpdater );
    if ( ! nodeToDelete ){
        throw 'No node found to be deleted at this index: ' + this.indexToUse;
    }
    
    // Run animation
    parserUpdater.runAnimation( 
        actionInstance, 
        nodeToDelete, 
        function(){
            
            // Remove the selected node from the index and from HTML
            //attributeIndex.removeNode( nodeToDelete ); 
            nodeRemover.removeNode( nodeToDelete );
            //TODO update next siblings?
            
            // Continue
            parserUpdater.continueUpdateHTML( continueData );
        } 
    );
    
    //return true;
    return false;
};

ArrayDelete.buildMultiple = function( object, dictionary ){

    var actions = [];
    var property = object.index? 'index': 'currentElement';

    // Copy indexes to a new array
    var allItems = utils.copyArray( object[ property ] );
    
    // Build actions list
    for ( var i = 0; i < allItems.length; ++i ){
        var item = allItems[ i ];
        
        // Clone the object and configure the index
        var newObject = utils.deepExtend( object );
        newObject[ property ] = item;
        
        // Instance the action instance and add it to the list
        var newActionInstance = new ArrayDelete( newObject, dictionary );
        newActionInstance.index = newActionInstance.getIndexToUse( dictionary );
        actions.push( newActionInstance );
    }
    
    // Sort actions
    actions.sort(
        function( a, b ){ return b.index - a.index; }
    );
    
    return actions;
};

module.exports = ArrayDelete;

},{"../../attributes/attributeIndex.js":16,"../../utils.js":94,"../nodeRemover.js":84,"./abstractArrayAction.js":72}],76:[function(_dereq_,module,exports){
/* 
    Class ArrayUpdate
*/
"use strict";

var AbstractArrayAction = _dereq_( './abstractArrayAction.js' );

var ArrayUpdate = function( object, dictionary ) {
    AbstractArrayAction.call( this, object, dictionary );
    
    this.newElement = object.newElement;
};

ArrayUpdate.prototype = Object.create( AbstractArrayAction.prototype );

ArrayUpdate.prototype.updateDictionary = function( dictionary ){
    
    this.indexToUse = this.getIndexToUse( dictionary );
    var arrayValue = this.getValue( dictionary );
    arrayValue[ this.indexToUse ] = this.newElement;
};

ArrayUpdate.prototype.updateHTML = function( indexItem, parserUpdater, actionInstance ){
    
    // Must get the nodeToUpdate
    var nodeToUpdate = this.resolveChildNode( indexItem, parserUpdater );
    if ( ! nodeToUpdate ){
        throw 'No node found to be updated at this index: ' + this.indexToUse;
    }
    
    // Update the selected node
    parserUpdater.updateNode( nodeToUpdate, true );
    
    // Run animation
    parserUpdater.runAnimation( actionInstance, nodeToUpdate );
    
    return true;
};

module.exports = ArrayUpdate;

},{"./abstractArrayAction.js":72}],77:[function(_dereq_,module,exports){
/* 
    Class CSSAnimationManager 
*/
"use strict";

module.exports = (function() {
    
    var animate = function( dictionaryAction, node, callback ) {
        
        // Run callback and return if there is no animation
        if ( ! dictionaryAction.animation ){
            if ( callback ){
                callback();
            };
            return;
        }
        
        // Set the animation
        node.style.animation = 'none';
        setTimeout(
            function() {
                // Set the animationend listener
                var animationendCallback = function( event ){
                    if ( callback ){
                        callback();
                    }
                };
                //node.removeEventListener( 'animationend', animationendCallback );
                node.addEventListener( 'animationend', animationendCallback );

                // Set the animation
                node.style.animation = dictionaryAction.animation;
            }, 
            10
        );
    };
    
    var reset = function( node ) {
        node.style.animation = 'none';
    };
    
    var self = {
        animate: animate,
        reset: reset
    };
    
    return self;
})();

},{}],78:[function(_dereq_,module,exports){
/* 
    Class dictionaryActionBuilder 
*/
"use strict";

var ArrayUpdate = _dereq_( './arrayUpdate.js' );
var ArrayDelete = _dereq_( './arrayDelete.js' );
var ArrayCreate = _dereq_( './arrayCreate.js' );
var ObjectUpdate = _dereq_( './objectUpdate.js' );
var ObjectDelete = _dereq_( './objectDelete.js' );

module.exports = (function() {
    
    var build = function( object, dictionary ) {
        
        switch ( object.action ) {
        case 'updateArray':
            return new ArrayUpdate( object, dictionary );
        case 'deleteArray':
            return Array.isArray( object.index ) || Array.isArray( object.currentElement )? 
                ArrayDelete.buildMultiple( object, dictionary ):
                new ArrayDelete( object, dictionary );
        case 'createArray':
            return Array.isArray( object.newElement )? 
                ArrayCreate.buildMultiple( object, dictionary ):
                new ArrayCreate( object, dictionary );
        case 'updateObject':
            return object.editedProperties || object.deletedProperties?
                ObjectUpdate.buildMultiple( object, dictionary ):
                new ObjectUpdate( object, dictionary );
        case 'deleteObject':
            return new ObjectDelete( object, dictionary );
        default:
            throw 'Unknown dictionary action: ' + object.action;
        }
    };
    
    var self = {
        build: build
    };
    
    return self;
})();

},{"./arrayCreate.js":74,"./arrayDelete.js":75,"./arrayUpdate.js":76,"./objectDelete.js":79,"./objectUpdate.js":80}],79:[function(_dereq_,module,exports){
/* 
    Class ObjectDelete
*/
"use strict";

var AbstractObjectAction = _dereq_( './abstractObjectAction.js' );

var ObjectDelete = function( object, dictionary ) {
    AbstractObjectAction.call( this, object, dictionary );
};

ObjectDelete.prototype = Object.create( AbstractObjectAction.prototype );

ObjectDelete.prototype.updateDictionary = function( dictionary ){
    
    var objectValue = this.getValue( dictionary );
    delete objectValue[ this.property ];
};

module.exports = ObjectDelete;

},{"./abstractObjectAction.js":73}],80:[function(_dereq_,module,exports){
/* 
    Class ObjectUpdate
*/
"use strict";

var AbstractObjectAction = _dereq_( './abstractObjectAction.js' );
var ObjectDelete = _dereq_( './objectDelete.js' );
var utils = _dereq_( '../../utils.js' );

var ObjectUpdate = function( object, dictionary ) {
    AbstractObjectAction.call( this, object, dictionary );
    
    this.newElement = object.newElement;
};

ObjectUpdate.prototype = Object.create( AbstractObjectAction.prototype );

ObjectUpdate.prototype.updateDictionary = function( dictionary ){
    
    var objectValue = this.getValue( dictionary );
    objectValue[ this.property ] = this.newElement;
};

ObjectUpdate.buildMultiple = function( object, dictionary ){

    var actions = [];
    var clonedObject = utils.deepExtend( object );
    
    // Copy editedProperties and deletedProperties
    var editedProperties = clonedObject.editedProperties;
    var deletedProperties = clonedObject.deletedProperties;
    
    // Delete them
    delete clonedObject.editedProperties;
    delete clonedObject.deletedProperties;
        
    // Build actions list for editedProperties
    if ( editedProperties ){
        clonedObject.action = 'updateObject';
        for ( var editedPropertiesId in editedProperties ){
            var editedPropertiesValue = editedProperties[ editedPropertiesId ];

            // Clone the object and configure property and newElement
            var newObject = utils.deepExtend( clonedObject );
            newObject.property = editedPropertiesId;
            newObject.newElement = editedPropertiesValue;

            // Instance the action instance and add it to the list
            var newActionInstance = new ObjectUpdate( newObject, dictionary );
            actions.push( newActionInstance );
        }
    }
    
    // Build actions list for deletedProperties
    if ( deletedProperties ){
        clonedObject.action = 'deleteObject';
        for ( var i = 0; i < deletedProperties.length; ++i ){
            var deletedPropertiesItem = deletedProperties[ i ];

            // Clone the object and configure property
            newObject = utils.deepExtend( clonedObject );
            newObject.property = deletedPropertiesItem;

            // Instance the action instance and add it to the list
            newActionInstance = new ObjectDelete( newObject, dictionary );
            actions.push( newActionInstance );
        }
    }
    
    return actions;
};

module.exports = ObjectUpdate;

},{"../../utils.js":94,"./abstractObjectAction.js":73,"./objectDelete.js":79}],81:[function(_dereq_,module,exports){
/* 
    Class Loop 
*/
"use strict";

var AutoDefineHelper = _dereq_( './autoDefineHelper.js' );
var expressionBuilder = _dereq_( '../expressions/expressionBuilder.js' );
var context = _dereq_( '../context.js' );

var Loop = function ( _itemVariableName, _expressionString, scope ) {
    
    var itemVariableName = _itemVariableName;
    var expressionString = _expressionString;
    
    var expression = expressionBuilder.build( expressionString );
    var getExpression = function(){
        return expression;
    };
    
    var items = expression.evaluate( scope );
    var getItems = function(){
        return items;
    };
    
    var currentIndex = -1;
    var maxIndex = items? items.length - 1: -1;
    
    var offset = 0;
    var setOffset = function( _offset ){
        offset = _offset;
    };
    
    var repeat = function(){
        
        if ( currentIndex++ < maxIndex ) {
            
            return Loop.buildAutoDefineHelper( 
                itemVariableName, 
                currentIndex, 
                expressionString, 
                items.length, 
                offset 
            );
        }
        
        return null;
    };
    
    return {
        setOffset: setOffset,
        repeat:repeat,
        getItems: getItems,
        getExpression: getExpression
    };
};

Loop.buildAutoDefineHelper = function( itemVariableName, itemIndex, expressionString, numberOfItems, offset ){
    
    var autoDefineHelper = new AutoDefineHelper();

    // Declare item-index, item-all, item and item-repeat variables
    autoDefineHelper.put(
        itemVariableName + '-index',
        itemIndex
    );
    autoDefineHelper.put(
        itemVariableName + '-all',
        expressionString
    );
    autoDefineHelper.put(
        itemVariableName,
        itemVariableName + '-all' + '[' + itemVariableName + '-index' + ']'
    );
    autoDefineHelper.put(
        itemVariableName + '-repeat',
        "context/repeat(" 
            + itemVariableName + "-index" + ","
            + numberOfItems + ","
            + offset
            + ")"
    );

    return autoDefineHelper;
};

Loop.setAutoDefineAttribute = function( node, itemVariableName, itemIndex, expressionString, numberOfItems, offset ){
    
    // Set item-index, item-all, item and item-repeat attributes
    node.setAttribute( 
        context.getTags().talAutoDefine,
        itemVariableName + '-index ' + itemIndex + ';'
            + itemVariableName + '-all ' + expressionString + ';'
            + itemVariableName + ' ' + itemVariableName +'-all[' + itemVariableName + '-index];'
            + itemVariableName + '-repeat context/repeat(' + itemVariableName + '-index,' + numberOfItems + ',' + offset + ')'
    );
};

module.exports = Loop;

},{"../context.js":20,"../expressions/expressionBuilder.js":39,"./autoDefineHelper.js":69}],82:[function(_dereq_,module,exports){
/* 
    Class LoopItem
*/
"use strict";

var LoopItem = function ( _currentIndex, _itemsLength, _offset ) {
    
    this.currentIndex = _currentIndex;
    this.itemsLength = _itemsLength;
    this.offset = _offset;
};

LoopItem.prototype.index = function( ) {
    return this.offset + this.currentIndex;
};

LoopItem.prototype.number = function( ) {
    return this.index() + 1;
};

LoopItem.prototype.even = function( ) {
    return this.index() % 2 === 0;
};

LoopItem.prototype.odd = function ( ) {
    return this.index() % 2 === 1;
};

LoopItem.prototype.start = function ( ) {
    return this.index() === 0;
};

LoopItem.prototype.end = function ( ) {
    return this.currentIndex === this.itemsLength - 1;
};

LoopItem.prototype.length = function () {
    return this.offset + this.itemsLength;
};

LoopItem.prototype.letter = function () {
    return this.formatLetter( this.index(), 'a' );
};

LoopItem.prototype.Letter = function () {
    return this.formatLetter( this.index(), 'A' );
};

LoopItem.prototype.formatLetter = function ( ii, startChar ) {
    var i = ii;
    var buffer = '';
    var start = startChar.charCodeAt( 0 ); 
    var digit = i % 26;
    buffer += String.fromCharCode( start + digit );

    while( i > 25 ) {
        i /= 26;
        digit = (i - 1 ) % 26;
        buffer += String.fromCharCode( start + digit );
    }

    return buffer.split('').reverse().join('');
};

LoopItem.prototype.roman = function () {
    return this.formatRoman( this.index() + 1, 0 );
};

LoopItem.prototype.Roman = function () {
    return this.formatRoman( this.index() + 1, 1 );
};

LoopItem.prototype.formatRoman = function ( nn, capital ) {
    var n = nn;

    // Can't represent any number 4000 or greater
    if ( n >= 4000 ) {
        return 'Overflow formatting roman!';
    }

    var buf = '';
    for ( var decade = 0; n !== 0; decade++ ) {
        var digit = n % 10;
        if ( digit > 0 ) {
            digit--;
            buf += this.romanArray [ decade ][ digit ][ capital ];
        }
        n = (n / 10) >> 0;
    }

    return buf.split( '' ).reverse().join( '' );
};

LoopItem.prototype.romanArray = [
    /* One's place */
    [
        [ "i", "I" ],
        [ "ii", "II" ], 
        [ "iii", "III" ],
        [ "vi", "VI" ],
        [ "v", "V" ],
        [ "iv", "IV" ],
        [ "iiv", "IIV" ],
        [ "iiiv", "IIIV" ],
        [ "xi", "XI" ]
    ],

    /* 10's place */
    [
        [ "x", "X" ],
        [ "xx", "XX" ],
        [ "xxx", "XXX" ],
        [ "lx", "LX" ],
        [ "l", "L" ],
        [ "xl", "XL" ],
        [ "xxl", "XXL" ],
        [ "xxxl", "XXXL" ],
        [ "cx", "CX" ]
    ],

    /* 100's place */
    [
        [ "c", "C" ],
        [ "cc", "CC" ],
        [ "ccc", "CCC" ],
        [ "dc", "DC" ],
        [ "d", "D" ],
        [ "cd", "CD" ],
        [ "ccd", "CCD" ],
        [ "cccd", "CCCD" ],
        [ "mc", "MC" ]
    ],

    /* 1000's place */
    [
        [ "m", "M" ],
        [ "mm", "MM" ],
        [ "mmm", "MMM" ]
    ]
];

module.exports = LoopItem;

},{}],83:[function(_dereq_,module,exports){
/* 
    Class NodeAttributes 
*/
"use strict";

var context = _dereq_( '../context.js' );

var NodeAttributes = function( node, indexExpressions ) {
    
    var tags = context.getTags();
    
    // tal namespace
    this.talDefine = node.getAttribute( tags.talDefine );
    this.talCondition = node.getAttribute( tags.talCondition );
    this.talRepeat = node.getAttribute( tags.talRepeat );
    this.talContent = node.getAttribute( tags.talContent );
    this.talAttributes = node.getAttribute( tags.talAttributes );
    this.talOmitTag = node.getAttribute( tags.talOmitTag );
    this.talReplace = node.getAttribute( tags.talReplace );
    this.talOnError = node.getAttribute( tags.talOnError );
    this.talDeclare = node.getAttribute( tags.talDeclare );
    //this.talTag = undefined;
    
    // metal namespace
    this.metalDefineMacro = node.getAttribute( tags.metalDefineMacro );
    this.metalUseMacro = node.getAttribute( tags.metalUseMacro );
    this.metalDefineSlot = node.getAttribute( tags.metalDefineSlot );
    this.metalFillSlot = node.getAttribute( tags.metalFillSlot );
    
    // i18n namespace
    this.i18nDomain = node.getAttribute( tags.i18nDomain );
    this.i18nLanguage = node.getAttribute( tags.i18nLanguage );
    
    // For internal use
    this.qdup = node.getAttribute( tags.qdup );
    
    // Init this.id and set the node id if indexExpressions is true, some attribute is set and it is undefined
    if ( indexExpressions && this.isDynamicContentOn() ){
        this.id = node.getAttribute( tags.id );
        if ( ! this.id ){
            //this.id = utils.generateId( 6 );
            this.id = context.nextExpressionCounter();
            node.setAttribute( tags.id, this.id );
        }
    }
};

NodeAttributes.prototype.isDynamicContentOn = function() {
    
    return this.talDefine 
        || this.talCondition
        || this.talRepeat
        || this.talContent
        || this.talAttributes
        || this.talOmitTag 
        || this.talReplace
        || this.talOnError
        || this.talDeclare
        //|| this.talTag
        //|| this.metalDefineMacro 
        || this.metalUseMacro 
        //|| this.metalDefineSlot 
        || this.metalFillSlot 
        || this.i18nDomain
        || this.i18nLanguage;
        //|| this.qdup;
};

module.exports = NodeAttributes;

},{"../context.js":20}],84:[function(_dereq_,module,exports){
/* 
    Class NodeRemover 
*/
"use strict";

var context = _dereq_( '../context.js' );

module.exports = (function() {
    
    var tags = context.getTags();
    
    var removeGeneratedNodes = function( target ) {
        
        // Is multiroot?
        if ( Array.isArray( target ) ){ 
            // There are several roots
            
            var result = [];
            for ( var c = 0; c < target.length; c++ ) {
                result = result.concat( 
                    removeNodes( target[ c ] )
                );
            }
            return result;
        }
        
        // There is only one root
        return removeNodes( target );
    };
    
    var removeNodes = function( target ) {
        
        var result = [];
        
        result = result.concat( removeNodesByTag( target, tags.qdup ) );       // Remove all generated nodes (repeats)
        result = result.concat( removeNodesByTag( target, tags.metalMacro ) ); // Remove all generated nodes (macros)
        
        return result;
    };
    
    var removeNodesByTag = function( target, tag ){
        
        var list = target.querySelectorAll( "*[" + tag + "]" );
        return removeList( list );
    };
    
    var removeRelatedNodes = function( target ){
        
        var list = target.parentNode.querySelectorAll( 
            '[' + context.getTags().relatedId + '="' + target.getAttribute( context.getTags().id ) + '"]' 
        );
        return removeList( list );
    };
    
    var removeList = function( list ){

        var result = [];
        
        var node;
        var pos = 0;
        while ( node = list[ pos++ ] ) {
            // Add nodeId to result if needed
            var nodeId = getNodeId( node );
            if ( nodeId !== undefined ){
                result.push( nodeId );
            }
            
            // Add the nodeIds of its children
            addNodeIdsToList( node, result );
            
            // Remove node
            node.parentNode.removeChild( node );
        }
        
        return result;
    };
    
    var addNodeIdsToList = function( target, result ){
        
        // Get the nodes with data-id
        var nodeIdAttributeName = context.getTags().id;
        var list = target.querySelectorAll( '[' + nodeIdAttributeName + ']' );
        
        // Iterate the list
        var node;
        var pos = 0;
        while ( node = list[ pos++ ] ) {
            result.push( 
                node.getAttribute( nodeIdAttributeName ) 
            );
        }
    };
    
    var getNodeId = function( node ){
        
        var nodeIdAttributeName = context.getTags().id;
        
        return node.hasAttribute( nodeIdAttributeName )?
            node.getAttribute( nodeIdAttributeName ):
            undefined;
    };
    
    var removeNode = function( node ){
        var nodeId = getNodeId( node );
        var parentNode = node.parentNode;
        if ( parentNode ){
            parentNode.removeChild( node );
        }
        return nodeId;
    };
    
    var removeMultipleNodes = function( node, mustRemoveGeneratedNodes ){
        
        var result = removeRelatedNodes( node );
        
        if ( mustRemoveGeneratedNodes ){
            result = result.concat(
                removeGeneratedNodes( node )
            );
        }
        
        return result;
    };
    
    var self = {
        removeGeneratedNodes: removeGeneratedNodes,
        //removeRelatedNodes: removeRelatedNodes,
        removeNode: removeNode,
        removeMultipleNodes: removeMultipleNodes
    };
    
    return self;
})();

},{"../context.js":20}],85:[function(_dereq_,module,exports){
/* 
    Class Parser 
*/
"use strict";

var context = _dereq_( '../context.js' );
var ParserRenderer = _dereq_( './parserRenderer.js' );
var ParserUpdater = _dereq_( './parserUpdater.js' );
var ParserPreloader = _dereq_( './parserPreloader.js' );
var ReactiveDictionary = _dereq_( '../scopes/reactiveDictionary.js' );

module.exports = (function() {
    
    var parserOptions = {
        command: undefined, // preload, fullRender or partialRender
        root: undefined,
        dictionary: {},
        indexExpressions: true
        //notRemoveGeneratedTags,
        //target,
        //declaredRemotePageUrls,
        //i18n,
        //callback,
        //failCallback,
    };
    
    var updateParserOptions = function( options ){
        
        parserOptions.command = options.command || 'fullRender';
        parserOptions.root = options.root === undefined? parserOptions.root: options.root;
        parserOptions.dictionary = ( options.dictionary instanceof ReactiveDictionary?
            options.dictionary._getNonReactiveDictionary(): 
            options.dictionary )
            || parserOptions.dictionary;
        //parserOptions.dictionary = options.dictionary || parserOptions.dictionary;
        parserOptions.indexExpressions = options.indexExpressions === undefined? parserOptions.indexExpressions: options.indexExpressions;
    };
    
    var run = function( _options ){
        
        var options = _options || {};
        
        // Init parser options
        updateParserOptions( options );
    
        var command = options.command || 'fullRender';
        switch ( command ) {
            case 'preload':
                return processPreload(
                    options.callback,
                    options.failCallback,
                    options.declaredRemotePageUrls || [],
                    options.i18n,
                    options.notRemoveGeneratedTags,
                    options.maxFolderDictionaries
                );
            case 'fullRender':
            case 'partialRender':
                return processRender(
                    command === 'partialRender'? options.target: parserOptions.root,
                    options.dictionaryExtension,
                    options.notRemoveGeneratedTags,
                    parserOptions.indexExpressions && command === 'fullRender',
                    options.goToURLHash === undefined? context.nextRunCounter() === 1: false
                );
            case 'update':
                return processUpdate( 
                    options.dictionaryChanges,
                    options.dictionaryActions
                );
            default:
                throw 'Unknown command: ' + command;
        }
    };
    
    var processPreload = function( callback, failCallback, declaredRemotePageUrls, i18n, notRemoveGeneratedTags, maxFolderDictionaries ){
        
        var parserPreloader = new ParserPreloader( 
            parserOptions, 
            callback, 
            failCallback, 
            declaredRemotePageUrls, 
            i18n, 
            notRemoveGeneratedTags, 
            maxFolderDictionaries
        );

        parserPreloader.run();

        return parserPreloader;
    };
    
    var processRender = function( target, dictionaryExtension, notRemoveGeneratedTags, resetIndex, goToURLHash ){
        
        var parserRenderer = new ParserRenderer( 
            parserOptions, 
            target, 
            dictionaryExtension, 
            notRemoveGeneratedTags, 
            resetIndex,
            goToURLHash
        );

        parserRenderer.run();
        
        return parserRenderer;
    };
    
    var processUpdate = function( dictionaryChanges, dictionaryActions ) {
        
        var parserUpdater = new ParserUpdater( 
            dictionaryChanges,
            dictionaryActions,
            parserOptions
        );

        parserUpdater.run();
        
        return parserUpdater;
    };
    
    var getOptions = function(){
        return parserOptions;
    };
    
    var self = {
        run: run,
        getOptions: getOptions
    };
    
    return self;
})();

},{"../context.js":20,"../scopes/reactiveDictionary.js":91,"./parserPreloader.js":87,"./parserRenderer.js":88,"./parserUpdater.js":89}],86:[function(_dereq_,module,exports){
(function (process){(function (){
/* 
    Class ParserNodeRenderer
*/
"use strict";

var context = _dereq_( '../context.js' );
var log = _dereq_( '../logHelper.js' );
var NodeAttributes = _dereq_( './nodeAttributes.js' );
var attributeCache = _dereq_( '../cache/attributeCache.js' );
var attributeIndex = _dereq_( '../attributes/attributeIndex.js' );
var AutoDefineHelper = _dereq_( './autoDefineHelper.js' );
var evaluateHelper = _dereq_( '../expressions/evaluateHelper.js' );
var Loop = _dereq_( './loop.js' );

var I18NDomain = _dereq_( '../attributes/I18N/i18nDomain.js' );
var I18NLanguage = _dereq_( '../attributes/I18N/i18nLanguage.js' );
var METALDefineMacro = _dereq_( '../attributes/METAL/metalDefineMacro.js' );
var METALUseMacro = _dereq_( '../attributes/METAL/metalUseMacro.js' );
var TALAttributes = _dereq_( '../attributes/TAL/talAttributes.js' );
var TALCondition = _dereq_( '../attributes/TAL/talCondition.js' );
var TALContent = _dereq_( '../attributes/TAL/talContent.js' );
var TALDefine = _dereq_( '../attributes/TAL/talDefine.js' );
var TALOmitTag = _dereq_( '../attributes/TAL/talOmitTag.js' );
var TALOnError = _dereq_( '../attributes/TAL/talOnError.js' );
var TALRepeat = _dereq_( '../attributes/TAL/talRepeat.js' );
var TALReplace = _dereq_( '../attributes/TAL/talReplace.js' );
var TALDeclare = _dereq_( '../attributes/TAL/talDeclare.js' );
var contentHelper = _dereq_( '../attributes/TAL/contentHelper.js' );

var ParserNodeRenderer = function( _target, _scope, _indexExpressions ) {
    
    var target = _target; 
    var scope = _scope;
    var indexExpressions = _indexExpressions;
    
    var tags = context.getTags();
    
    var run = function(){
        process( target );
    };
    
    var process = function( node ) {

        try {
            // Get the attributes from the node
            var attributes = new NodeAttributes( node, indexExpressions );
            
            scope.startElement();

            // Process instructions
            attributes.talRepeat != null ? 
                processLoop( node, attributes ):
                processElement( node, attributes );

            scope.endElement();

        } catch ( e ) {
            
            // Try to treat error
            if ( ! treatError( node, e ) ) {
                throw e;
            }
        }
    };
    
    var processLoopNextSibling = function( node ){

        var counter = -1;
        var nextSibling = node;
        do {
            ++counter;
            nextSibling = nextSibling.nextElementSibling;
            if ( ! nextSibling ){
                return {
                    nextSibling: null,
                    counter: counter
                };
            }
        } while ( nextSibling.hasAttribute( tags.qdup ) );

        return {
            nextSibling: nextSibling,
            counter: counter
        };
    };
    
    var processLoop = function( node, attributes ) {
        
        // Process repeat
        //var talRepeat = TALRepeat.build( attributes.talRepeat );
        var talRepeat = attributeCache.getByAttributeClass( 
            TALRepeat, 
            attributes.talRepeat, 
            node,
            indexExpressions,
            scope
        );
        var loop = talRepeat.process( scope, node );

        // Check default
        if ( evaluateHelper.isDefault( loop.getItems() ) ){
            processElement( node, attributes );
            return true;
        }
        
        // Configure the node to clone it later
        node.removeAttribute( tags.talRepeat );
        node.removeAttribute( 'style' );
        node.setAttribute( tags.qdup, 1 );
        var nodeId = node.getAttribute( 'id' );
        node.removeAttribute( 'id' );
        var nodeDataId = node.getAttribute( tags.id );
        node.removeAttribute( tags.id );
        
        var nextSiblingData = processLoopNextSibling( node );
        var nextSibling = nextSiblingData.nextSibling;
        loop.setOffset( nextSiblingData.counter );
        //log.warn( 'loop counter: ' + nextSiblingData.counter );
        
        var autoDefineHelper;
        while ( autoDefineHelper = loop.repeat() ) {
            
            scope.startElement();
            
            // Clone and configure the node
            var tmpNode = ParserNodeRenderer.cloneAndConfigureNode( node, indexExpressions, tags, nodeDataId );

            // Insert it
            var parentNode = node.parentNode;
            parentNode.insertBefore( tmpNode, nextSibling );
            
            // Process it
            if ( ! processElement( tmpNode, attributes, autoDefineHelper ) ) {
                scope.endElement();
                return false;
            }
            
            scope.endElement();
        }

        // Configure repeat node (the original) to enable future reevaluation
        node.style.display = 'none';
        node.setAttribute( tags.talRepeat, attributes.talRepeat );
        if ( nodeId !== '' && nodeId != null ){
            node.setAttribute( 'id', nodeId );
        }
        if ( nodeDataId !== '' && nodeDataId != null ){
            node.setAttribute( tags.id, nodeDataId );
        }
        node.removeAttribute( tags.qdup );
        
        return true;
    };

    var treatError = function( node, exception ) {

        try {
            // Set the error variable
            var templateError = {
                type: exception.name,
                value: exception.message,
                traceback: exception.stack
            };
            scope.set( 
                context.getConf().templateErrorVarName, 
                templateError 
            );
            
            // Exit if there is no on-error expression defined
            var content = scope.get( context.getConf().onErrorVarName );
            if ( content == null ) {
                log.fatal( exception );
                scope.endElement();
                return false;
            }
            
            log.error( exception );
            scope.endElement();
            
            contentHelper.updateNode( 
                node, 
                scope.get( context.getConf().onErrorStructureVarName ), 
                content 
            );
            
            return content;
            
        } catch ( e ) {
            log.fatal( e );
            scope.endElement();
            throw e;
        }
    };
    
    var processElement = function( node, attributes, _autoDefineHelper ) {

        // If it is defined a metalFillSlot or a metalDefineMacro do nothing
        if ( attributes.metalFillSlot || ! processMETALDefineMacro(
            node, 
            attributes.metalDefineMacro 
        ) ) {
            // Stop processing the rest of this node as it is invisible
            return false;
        }
        
        var autoDefineHelper = _autoDefineHelper || new AutoDefineHelper( node );
        
        if ( ! processDeclare( 
            node,
            attributes.talDeclare,
            autoDefineHelper
        ) ) {
            // Stop processing the rest of this node as it is invisible
            return false;
        }
        
        processOnError( 
            node,
            attributes.talOnError,
            autoDefineHelper
        );
        
        processI18nLanguage( 
            node,
            attributes.i18nLanguage,
            autoDefineHelper
        );
        
        processI18nDomain(
            node,
            attributes.i18nDomain, 
            autoDefineHelper
        );
        
        processAutoDefine( 
            node, 
            autoDefineHelper
        );
        
        ParserNodeRenderer.processDefine( 
            node,
            attributes.talDefine,  
            false,
            scope,
            indexExpressions
        );
        
        if ( ! processCondition(
                node, 
                attributes.talCondition 
        ) ) {
            // Stop processing the rest of this node as it is invisible
            return false;
        }

        var omittedTag = processOmitTag(
                node, 
                attributes.talOmitTag 
        );

        var replaced = processReplace(
                node, 
                attributes.talReplace 
        );

        if ( ! omittedTag && ! replaced ) {
            
            processAttributes(
                    node, 
                    attributes.talAttributes 
            );

            if ( ! processContent(
                    node, 
                    attributes.talContent ) ) {

                defaultContent( node );
            }
        }

        processMETALUseMacro(
                node, 
                attributes.metalUseMacro, 
                attributes.talDefine,
                autoDefineHelper
        );
        
        return true;
    };

    var defaultContent = function( node ) {

        var childNodes = node.childNodes;
        if ( ! childNodes ) {
            return;
        }

        for ( var i = 0; i < childNodes.length; i++ ) {
            var currentChildNode = childNodes[ i ];

            // Check if node is ELEMENT_NODE and not parsed yet
            if ( currentChildNode && currentChildNode.nodeType === 1
                    && ! currentChildNode.getAttribute( tags.qdup ) ) {
                process( currentChildNode );
            }
        }
    };
    
    var processOnError = function( node, string, autoDefineHelper ) {

        if ( ! string ) {
            return;
        }

        var talOnError = attributeCache.getByAttributeClass( 
            TALOnError, 
            string, 
            node,
            indexExpressions,
            scope
        );
        return talOnError.putToAutoDefineHelper( autoDefineHelper );
    };
    
    var processAutoDefine = function( node, autoDefineHelper ) {
        
        var string = autoDefineHelper.updateNode( node );
        if ( ! string ) {
            return;
        }
        
        var talDefine = attributeCache.getByAttributeClass( 
            TALDefine, 
            string, 
            node,
            indexExpressions,
            scope
        );
        return talDefine.process( scope, false );
    };

    var processI18nDomain = function( node, string, autoDefineHelper ) {

        if ( ! string ) {
            return;
        }

        var i18nDomain = attributeCache.getByAttributeClass( 
            I18NDomain, 
            string, 
            node,
            indexExpressions,
            scope
        );
        return i18nDomain.putToAutoDefineHelper( scope, autoDefineHelper );
    };
    
    var processI18nLanguage = function( node, string, autoDefineHelper ) {

        if ( ! string ) {
            return;
        }

        var i18nLanguage = attributeCache.getByAttributeClass( 
            I18NLanguage, 
            string, 
            node,
            indexExpressions,
            scope
        );
        return i18nLanguage.putToAutoDefineHelper( autoDefineHelper );
    };
    
    var processDeclare = function( node, string, autoDefineHelper ) {

        if ( ! string ) {
            return true;
        }

        var talDeclare = attributeCache.getByAttributeClass( 
            TALDeclare, 
            string, 
            node,
            indexExpressions,
            scope
        );
        return talDeclare.process( scope, autoDefineHelper );
    };
    
    var processMETALDefineMacro = function( node, string ) {

        if ( ! string ) {
            return true;
        }

        // No sense to cache macro definitions!
        var metalDefineMacro = METALDefineMacro.build( string );
        return metalDefineMacro.process( scope, node );
    };

    var processMETALUseMacro = function( node, string, stringDefine, autoDefineHelper ) {

        if ( ! string ) {
            return;
        }
        
        // No sense to cache macro uses!
        var metalUseMacro = METALUseMacro.build( string, stringDefine, scope );
        var newNode = metalUseMacro.process( scope, node, autoDefineHelper, indexExpressions );
        newNode.setAttribute( tags.qdup, 1 );
        
        // Index node
        if ( indexExpressions ){
            attributeIndex.add( node, metalUseMacro, scope );
        }
    
        // Process new node
        return process( newNode );
    };

    var processCondition = function( node, string ) {

        if ( ! string ) {
            return true;
        }

        var talCondition = attributeCache.getByAttributeClass( 
            TALCondition, 
            string, 
            node,
            indexExpressions,
            scope
        );
        return talCondition.process( scope, node );
    };
    
    var processReplace = function( node, string ) {
        
        if ( ! string ){
            return false;
        }
        
        var talReplace = attributeCache.getByAttributeClass( 
            TALReplace, 
            string, 
            node,
            indexExpressions,
            scope
        );
        return talReplace.process( scope, node );
    };

    var processOmitTag = function( node, string ) {

        if ( string == null ) {
            return false;
        }

        var talOmitTag = attributeCache.getByAttributeClass( 
            TALOmitTag, 
            string, 
            node,
            indexExpressions,
            scope
        );
        return talOmitTag.process( scope, node, self );
    };
    
    var processContent = function( node, string ) {
        
        if ( ! string ){
            return false;
        }

        var talContent = attributeCache.getByAttributeClass( 
            TALContent, 
            string, 
            node,
            indexExpressions,
            scope
        );
        return talContent.process( scope, node );
    };
  
    var processAttributes = function( node, string ) {

        if ( ! string ) {
            return;
        }

        var talAttributes = attributeCache.getByAttributeClass( 
            TALAttributes, 
            string, 
            node,
            indexExpressions,
            scope 
        );
        return talAttributes.process( scope, node );
    };
    
    var self = {
        run: run,
        defaultContent: defaultContent
    };
    
    return self;
};

ParserNodeRenderer.processDefine = function( node, string, forceGlobal, scope, indexExpressions ) {

    if ( ! string ) {
        return;
    }

    var talDefine = attributeCache.getByAttributeClass( 
        TALDefine, 
        string, 
        node,
        indexExpressions,
        scope
    );
    return talDefine.process( scope, forceGlobal );
};

ParserNodeRenderer.cloneAndConfigureNode = function( node, indexExpressions, tags, nodeDataId ) {
    
    // Clone node
    var tmpNode = node.cloneNode( true );
    if ( 'form' in tmpNode ) {
        tmpNode.checked = false;
    }

    // Set id and related id if needed
    if ( indexExpressions ){
        tmpNode.setAttribute( tags.id, context.nextExpressionCounter() );
        tmpNode.setAttribute( tags.relatedId, nodeDataId );
    }
    
    return tmpNode;
};

ParserNodeRenderer.configureNodeForNewItem = function( tmpNode, tags, parentNode, indexItem, indexToUse ) {
    
    // Remove attributes
    tmpNode.removeAttribute( tags.talRepeat );
    tmpNode.removeAttribute( 'style' );
    tmpNode.setAttribute( tags.qdup, 1 );
    
    // Configure loop attributes
    Loop.setAutoDefineAttribute( 
        tmpNode, 
        indexItem.attributeInstance.getVarName(), 
        indexToUse,
        indexItem.attributeInstance.getExpressionString(), 
        parentNode.childElementCount, 
        0
    );
};

module.exports = ParserNodeRenderer;

}).call(this)}).call(this,_dereq_('_process'))
},{"../attributes/I18N/i18nDomain.js":1,"../attributes/I18N/i18nLanguage.js":2,"../attributes/METAL/metalDefineMacro.js":3,"../attributes/METAL/metalUseMacro.js":5,"../attributes/TAL/contentHelper.js":6,"../attributes/TAL/talAttributes.js":7,"../attributes/TAL/talCondition.js":8,"../attributes/TAL/talContent.js":9,"../attributes/TAL/talDeclare.js":10,"../attributes/TAL/talDefine.js":11,"../attributes/TAL/talOmitTag.js":12,"../attributes/TAL/talOnError.js":13,"../attributes/TAL/talRepeat.js":14,"../attributes/TAL/talReplace.js":15,"../attributes/attributeIndex.js":16,"../cache/attributeCache.js":17,"../context.js":20,"../expressions/evaluateHelper.js":37,"../logHelper.js":67,"./autoDefineHelper.js":69,"./loop.js":81,"./nodeAttributes.js":83,"_process":99}],87:[function(_dereq_,module,exports){
/* 
    Class ParserPreloader
*/
"use strict";

var context = _dereq_( '../context.js' );
var log = _dereq_( '../logHelper.js' );
var nodeRemover = _dereq_( './nodeRemover.js' );
var Scope = _dereq_( '../scopes/scope.js' );
var i18nHelper = _dereq_( '../i18n/i18nHelper.js' );
var resolver = _dereq_( '../resolver.js' );
var attributeIndex = _dereq_( '../attributes/attributeIndex.js' );

var ParserPreloader = function( _parserOptions, _callback, _failCallback, _declaredRemotePageUrls, _i18n, _notRemoveGeneratedTags, _maxFolderDictionaries ) {
    
    var parserOptions = _parserOptions;
    var callback = _callback;
    var failCallback = _failCallback;
    var declaredRemotePageUrls = _declaredRemotePageUrls;
    var i18n = _i18n;
    var notRemoveGeneratedTags = _notRemoveGeneratedTags;
    var maxFolderDictionaries = _maxFolderDictionaries;
    
    var run = function(){

        try {
            if ( ! notRemoveGeneratedTags ){
                nodeRemover.removeGeneratedNodes( parserOptions.root );
                /*
                attributeIndex.removeMultipleNodes(
                    nodeRemover.removeGeneratedNodes( parserOptions.root )
                );
                */
            }

            var scope = new Scope( 
                parserOptions.dictionary, 
                parserOptions.dictionaryExtension, 
                true 
            );

            scope.loadFolderDictionariesAsync( 
                maxFolderDictionaries, 
                window.location,
                function(){
                    context.setFolderDictionaries( scope.folderDictionaries );

                    i18nHelper.loadAsyncAuto( 
                        parserOptions.dictionary,
                        i18n,
                        function(){
                            resolver.loadRemotePages( 
                                scope,
                                declaredRemotePageUrls,
                                callback,
                                failCallback
                            );
                        },
                        failCallback
                    );
                } 
            );

        } catch( e ){
            log.fatal( 'Exiting init method of ZPT with errors: ' + e );
            throw e;
        }
    };

    
    var self = {
        run: run
    };
    
    return self;
};

module.exports = ParserPreloader;

},{"../attributes/attributeIndex.js":16,"../context.js":20,"../i18n/i18nHelper.js":66,"../logHelper.js":67,"../resolver.js":90,"../scopes/scope.js":92,"./nodeRemover.js":84}],88:[function(_dereq_,module,exports){
(function (process){(function (){
/* 
    Class ParserRenderer
*/
"use strict";

var context = _dereq_( '../context.js' );
var log = _dereq_( '../logHelper.js' );
var attributeCache = _dereq_( '../cache/attributeCache.js' );
var attributeIndex = _dereq_( '../attributes/attributeIndex.js' );
var nodeRemover = _dereq_( './nodeRemover.js' );
var scopeBuilder = _dereq_( '../scopes/scopeBuilder.js' );
var ParserNodeRenderer = _dereq_( './parserNodeRenderer.js' );

var ParserRenderer = function( _parserOptions, _target, _dictionaryExtension, _notRemoveGeneratedTags, _resetIndex, _goToURLHash ) {
    
    var parserOptions = _parserOptions;
    var target = _target;
    var dictionaryExtension = _dictionaryExtension;
    var notRemoveGeneratedTags = _notRemoveGeneratedTags;
    var resetIndex = _resetIndex;
    var goToURLHash = _goToURLHash;
    
    var run = function(){
        process();
    };
    
    var process = function(){

        try {
            if ( ! target ){
                throw 'Unable to process null root or target!';
            }

            if ( ! notRemoveGeneratedTags ){
                nodeRemover.removeGeneratedNodes( target );
                /*
                attributeIndex.removeMultipleNodes(
                    nodeRemover.removeGeneratedNodes( target )
                );
                */
            }

            if ( resetIndex ){
                attributeIndex.reset();
                attributeCache.reset();
            }

            processAllTargetElements();
            
            if ( goToURLHash ){
                processGoToURLHash();
            }

        } catch( e ){
            log.fatal( 'Exiting run method of ZPT with errors: ' + e );
            context.errorFunction( e );
            //throw e;
        }
    };

    var processAllTargetElements = function() {

        // Is multiroot?
        if ( Array.isArray( target ) ){ 
            // There are several roots
            for ( var c = 0; c < target.length; c++ ) {
                process1Target( target[ c ] );
            }
        } else {
            // There is only one root
            process1Target( target );
        }
    };

    var process1Target = function( currentTarget ) {

        var parserNodeRenderer = new ParserNodeRenderer( 
            currentTarget, 
            scopeBuilder.build( 
                parserOptions, 
                currentTarget, 
                dictionaryExtension,
                parserOptions.command === 'partialRender'
            ),
            parserOptions.indexExpressions
        );

        parserNodeRenderer.run();
    };
    
    var processGoToURLHash = function(){
        
        var id = decodeURI( window.location.hash ).substr( 1 );
        if ( ! id ){
            return;
        }
        
        var element = window.document.getElementById( id );
        if ( ! element ){
            log.warn( 'Unable to go to URL hash. Element with id "' + id + '" not found!' );
            return;
        }

        // Go to hash
        window.location.href = '#' + id;
    };
    
    var self = {
        run: run
    };
    
    return self;
};

module.exports = ParserRenderer;

}).call(this)}).call(this,_dereq_('_process'))
},{"../attributes/attributeIndex.js":16,"../cache/attributeCache.js":17,"../context.js":20,"../logHelper.js":67,"../scopes/scopeBuilder.js":93,"./nodeRemover.js":84,"./parserNodeRenderer.js":86,"_process":99}],89:[function(_dereq_,module,exports){
/* 
    Class ParserUpdater
*/
"use strict";

var context = _dereq_( '../context.js' );
var log = _dereq_( '../logHelper.js' );
var attributeIndex = _dereq_( '../attributes/attributeIndex.js' );
var scopeBuilder = _dereq_( '../scopes/scopeBuilder.js' );
var ParserNodeRenderer = _dereq_( './parserNodeRenderer.js' );
var nodeRemover = _dereq_( './nodeRemover.js' );
var utils = _dereq_( '../utils.js' );
var dictionaryActionBuilder = _dereq_( './dictionaryActions/dictionaryActionBuilder.js' );
var AbstractArrayAction = _dereq_( './dictionaryActions/abstractArrayAction.js' );

var ParserUpdater = function( _dictionaryChanges, _dictionaryActions, _parserOptions ) {
    
    var dictionaryChanges = _dictionaryChanges;
    var dictionaryActions = _dictionaryActions;
    var parserOptions = _parserOptions;
    
    var scopeMap = {};
    var nodeAttributes, 
        statistics;
    var dictionaryActionsInstances;
    
    var initializeDictionaryActionsInstances = function(){
        
        dictionaryActionsInstances = [];
        
        if ( ! dictionaryActions ){
            return;
        }
        
        for ( var i = 0; i < dictionaryActions.length; ++i ){
            var action = dictionaryActions[ i ];
            var newActionInstance = dictionaryActionBuilder.build( action, parserOptions.dictionary );
            if ( Array.isArray( newActionInstance ) ){
                dictionaryActionsInstances = dictionaryActionsInstances.concat( newActionInstance );
            } else {
                dictionaryActionsInstances.push( newActionInstance );
            }
        }
    };
    initializeDictionaryActionsInstances();
    
    var getStatistics = function(){
        return statistics;
    };

    var updateDictionaryForDictionaryChanges = function(){
        
        if ( dictionaryChanges ){
            utils.extend( parserOptions.dictionary, dictionaryChanges );
        }
    };
    
    var addUpdatedToStatistics = function(){
        ++statistics.totalUpdates;
    };
    
    var addRemovedToStatistics = function(){
        ++statistics.removedNodeUpdates;
    };
    
    var run = function(){
        
        try {
            // Check the index was built
            if ( ! parserOptions.indexExpressions ){
                throw 'Unable to update, no index built! Set indexExpressions to true!';
            }
            
            // Init some vars
            nodeAttributes = {};
            statistics = {
                totalUpdates: 0,
                removedNodeUpdates: 0
            };

            // Do all required HTML updates
            updateHTML();
            
        } catch( e ){
            log.fatal( 'Exiting run method of update command of ZPT with errors: ' + e );
            context.errorFunction( e );
        }
    };

    var updateHTML = function(){

        if ( updateHTMLFromActions( 0 ) ){
            updateHTMLFromVarChange();
        }
    };
    
    var updateHTMLFromActions = function( initial ){

        for ( var i = initial; i < dictionaryActionsInstances.length; ++i ){
            var actionInstance = dictionaryActionsInstances[ i ];
            
            // Update dictionary using action
            actionInstance.updateDictionary( parserOptions.dictionary );
            
            // Get the list of changes related to varName
            var list = attributeIndex.getVarsList( actionInstance.id );
            if ( ! list ){
                continue;
            }
            
            // Iterate list and update HTML if required
            if ( ! updateHTMLFromVarsList( actionInstance, i, 0, list ) ){
                return false;
            }
            /*
            for ( var j = 0; j < list.length; j++ ) {
                var indexItem = list[ j ];
                if ( ! actionInstance.attributeInstanceIsRelated( indexItem.attributeInstance ) ){
                    if ( ! utils.isFunction( indexItem.attributeInstance.updatableFromAction ) 
                            || indexItem.attributeInstance.updatableFromAction( self, findNodeById( indexItem.nodeId ) ) ){
                        buildDataFromVarChangeExcluding( actionInstance.id );
                    }
                    continue;
                }
                
                if ( ! actionInstance.updateHTML( 
                    indexItem, 
                    self, 
                    actionInstance, 
                    { 
                        actionInstance: actionInstance,
                        i: i, 
                        list: list,
                        initialJ: j 
                    }
                ) ){
                    return false;
                }
            }
            */
        }
        
        return true;
    };
    
    var updateHTMLFromVarsList = function( actionInstance, i, initialJ, list ){
        
        // Iterate list and update HTML if required
        for ( var j = initialJ; j < list.length; j++ ) {
            var indexItem = list[ j ];
            if ( ! actionInstance.attributeInstanceIsRelated( indexItem.attributeInstance ) ){
                if ( ! utils.isFunction( indexItem.attributeInstance.updatableFromAction ) 
                        || indexItem.attributeInstance.updatableFromAction( self, findNodeById( indexItem.nodeId ) ) ){
                    buildDataFromVarChangeExcluding( actionInstance.id );
                }
                continue;
            }

            if ( ! actionInstance.updateHTML( 
                indexItem, 
                self, 
                actionInstance, 
                { 
                    actionInstance: actionInstance,
                    i: i, 
                    initialJ: j,
                    list: list
                }
            ) ){
                return false;
            }
        }
        
        return true;
    };
    
    var continueUpdateHTML = function( continueData ){

        updateHTMLFromVarsList(
            continueData.actionInstance, 
            continueData.i, 
            continueData.initialJ + 1, 
            continueData.list
        );
        
        if ( updateHTMLFromActions( continueData.i + 1 ) ){
            updateHTMLFromVarChange();
        }
    };
    
    var runAnimation = function( actionInstance, node, callback ){
        
        // Build combinedCallback combining callback and actionInstance.animationCallback
        var combinedCallback = function(){
                if ( callback ){
                    callback();
                } else {
                    context.getAnimationManager().reset( node );
                }
                if ( actionInstance.animationCallback ){
                    actionInstance.animationCallback();
                }
            };
        
        // Get animation manager to run animation
        context.getAnimationManager().animate( actionInstance, node, combinedCallback );
    };
    /*
    var runAnimation = function( actionInstance, node, callback ){
        
        // Build combinedCallback combining callback and actionInstance.animationCallback
        var combinedCallback = ! callback && ! actionInstance.animationCallback? 
            undefined:
            function(){
                if ( callback ){
                    callback();
                }
                if ( actionInstance.animationCallback ){
                    actionInstance.animationCallback();
                }
            };
        
        // Get animation manager to run animation
        context.getAnimationManager().animate( actionInstance, node, combinedCallback );
    };
    */
    
    var updateHTMLFromVarChange = function(){
        
        // Update dictionary
        updateDictionaryForDictionaryChanges();
        
        // Build data
        for ( var varName in dictionaryChanges ){
            buildDataFromVarChange( varName );
        }
        
        // Update attributes
        for ( var i in nodeAttributes ) {
            var currentNodeAttributeList = nodeAttributes[ i ];
            for ( var j in currentNodeAttributeList ){
                updateAttribute( currentNodeAttributeList[ j ] );   
            }
        }
    };
    
    var buildDataFromVarChange = function( varName ){
        
        // Get the list of changes related to varName
        var list = attributeIndex.getVarsList( varName );
        buildDataFromList( varName, list );
    };
    
    var buildDataFromVarChangeExcluding = function( varName ){
        
        // Get the list of changes related to varName
        var list = attributeIndex.getVarsList( varName );
        
        var filtered = list.filter(
            function( indexItem, index, arr ){
                return ! AbstractArrayAction.staticAttributeInstanceIsRelated(
                    indexItem.attributeInstance
                );
            }
        );
        
        buildDataFromList( varName, filtered );
    };
    
    var buildDataFromList = function( varName, list ){
        
        if ( ! list ){
            return;
        }
        
        // Build data about all changes
        var length = list.length;
        for ( var i = 0; i < length; i++ ) {
            addNewNodeAttribute( varName, list[ i ] );
            /*
            if ( ! addNewNodeAttribute( varName, list[ i ] ) ){
                attributeIndex.removeVar( varName, list[ i ].nodeId );
            }
            */
        }
    };
    
    var findNodeById = function ( nodeId ) {
        
        return window.document.querySelector( 
            '[' + context.getTags().id + '="' + nodeId + '"]' 
        );
    };

    var addNewNodeAttribute = function( varName, indexItem ){

        var attributeInstance = indexItem.attributeInstance;
        var node = findNodeById( indexItem.nodeId );
        if ( ! node ){
            // Removed node!
            ++statistics.removedNodeUpdates;
            return false;
        }

        // Add data to nodeData
        var thisNodeData = nodeAttributes[ indexItem.nodeId ];
        if ( ! thisNodeData ){
            thisNodeData = {};
            nodeAttributes[ indexItem.nodeId ] = thisNodeData;
        }
        var elementId = indexItem.groupId? 
            attributeInstance.type + '/' + indexItem.groupId: 
            attributeInstance.type;
        thisNodeData[ elementId ] = indexItem;

        return true;
    };
    
    var updateAttribute = function( indexItem ){
        
        var attributeInstance = indexItem.attributeInstance;
        var node = findNodeById( indexItem.nodeId );
        if ( ! node ){
            // Removed node!
            ++statistics.removedNodeUpdates;
            return false;
        }
        
        ++statistics.totalUpdates;
        
        var scope = getNodeScope( node, indexItem.nodeId );
        
        attributeInstance.update( self, node, scope, indexItem );
        
        return true;
    };

    var getNodeScope = function( node, nodeId ){
        
        if ( ! nodeId ){
            nodeId = node.getAttribute( context.getTags().id );
        }
        
        var thisScope = scopeMap[ nodeId ];
        
        if ( ! thisScope ){
            thisScope = scopeBuilder.build( 
                parserOptions, 
                node, 
                undefined,
                true
            );
            scopeMap[ nodeId ] = thisScope;
        }

        return thisScope;
    };
    
    var updateNode = function( node, mustRemoveGeneratedNodes ){
        
        // Remove related to node nodes
        nodeRemover.removeMultipleNodes( node, mustRemoveGeneratedNodes );
        /*
        attributeIndex.removeMultipleNodes(
            nodeRemover.removeMultipleNodes( node, mustRemoveGeneratedNodes )
        );
        */
        
        // Instance and invoke parserNodeRenderer to update node
        var parserNodeRenderer = new ParserNodeRenderer( 
            node, 
            scopeBuilder.build( 
                parserOptions, 
                node, 
                undefined,
                true
            ),
            true
        );
        parserNodeRenderer.run();
    };
    /*
    var deleteNode = function( node ){
        node.parentNode.removeChild( node );
    };
    */
    var self = {
        run: run,
        updateNode: updateNode,
        //deleteNode: deleteNode,
        findNodeById: findNodeById,
        getNodeScope: getNodeScope,
        getStatistics: getStatistics,
        addUpdatedToStatistics: addUpdatedToStatistics,
        addRemovedToStatistics: addRemovedToStatistics,
        runAnimation: runAnimation,
        continueUpdateHTML: continueUpdateHTML
    };
    
    return self;
};

module.exports = ParserUpdater;

},{"../attributes/attributeIndex.js":16,"../context.js":20,"../logHelper.js":67,"../scopes/scopeBuilder.js":93,"../utils.js":94,"./dictionaryActions/abstractArrayAction.js":72,"./dictionaryActions/dictionaryActionBuilder.js":78,"./nodeRemover.js":84,"./parserNodeRenderer.js":86}],90:[function(_dereq_,module,exports){
/* 
    resolver singleton class
*/
var utils = _dereq_( './utils.js' );
var context = _dereq_( './context.js' );
var expressionBuilder = _dereq_( './expressions/expressionBuilder.js' );

module.exports = (function( ) {
    "use strict";
    
    var macros = {};
    var remotePages = {};
    
    var getNode = function( macroKey, scope ) {
        
        var node = macros[ macroKey ];
        
        if ( ! node ){
            node = loadNode( macroKey, scope );
        }
        
        return node? node.cloneNode( true ): undefined;
    };
    /*
    var isRemote = function( macroKey ){
        return -1 != macroKey.indexOf( context.getConf().macroDelimiter );
    };*/
    
    var getMacroDataUsingExpression = function ( macroKeyExpression, scope ){
        
        var macroKey = macroKeyExpression.evaluate( scope );
        
        if ( ! macroKey ){
            return {
                macroId: null,
                url: null
            };
        }
        
        return getMacroData( macroKey, scope );
    };
    
    var getMacroDataUsingExpressionString = function ( macroKeyExpressionString, scope ){
        
        var macroKeyExpression = expressionBuilder.build( macroKeyExpressionString );
        return getMacroDataUsingExpression( macroKeyExpression, scope );
    };
    
    var getMacroData = function ( macroKey, scope ){

        var index = macroKey.indexOf( context.getConf().macroDelimiter );
        
        return index === -1?
            {
                macroId: macroKey,
                url: null
            }:
            {
                macroId: macroKey.substring( 0, index ),
                url: buildURL ( macroKey.substring( 1 + index ) )
            };
    };
    
    var builDefineMacroSelector = function( macroId ){
        return "[" + filterSelector( context.getTags().metalDefineMacro ) + "='" + macroId + "']";
    };
    
    var loadNode = function( macroKey, scope ){

        var macroData = getMacroData( macroKey, scope );

        if ( macroData.url ){
            // Node is in another page
            return loadRemoteNode( macroKey, macroData );
        }
        
        // No url set
        var urlInScope = scope.get( context.getConf().externalMacroUrlVarName );
        if ( urlInScope ){
            // Try to find node in another page but using a previously defined url
            macroData.url = urlInScope;
            var remoteNode = loadRemoteNode( macroKey, macroData );
            if ( remoteNode ){
                // Node is found in another page
                return remoteNode;
            }
        }
        
        // Node is in this page
        var macroId = macroData.macroId;
        var selector = builDefineMacroSelector( macroId );
        var node = window.document.querySelector( selector );

        if ( ! node ){
            throw "Node using selector '" + selector + "' is null!";
        }

        return configureNode( 
            node.cloneNode( true ), 
            macroId,
            macroKey );
        
    };
    var loadRemoteNode = function( macroKey, macroData ){
        
        var element = remotePages[ macroData.url ];
        
        if ( ! element ){
            throw 'Macros in URL ' + macroData.url + ' not preloaded!';
        }
        
        var selector = builDefineMacroSelector( macroData.macroId );
        var node = element.querySelector( selector );
        
        if ( ! node ){
            return undefined;
        }
        
        return configureNode( 
                    node.cloneNode( true ), 
                    macroData.macroId,
                    macroKey );
    };
    
    var buildRemotePageUrlList = function( scope, declaredRemotePageUrls ){
        
        var remotePageUrls = declaredRemotePageUrls.slice();
        
        var list = document.querySelectorAll( 
            "[" + filterSelector( context.getTags().metalUseMacro ) + "]"
        );
        var currentMacroUse;
        var pos = 0;
        while ( currentMacroUse = list[ pos++ ] ) {
            var macroKeyExpressionString = currentMacroUse.getAttribute( context.getTags().metalUseMacro );
            
            try {
                var macroData = getMacroDataUsingExpressionString( macroKeyExpressionString, scope );

                var url = macroData.url;
                if ( url && remotePageUrls.indexOf( url ) === -1 ){
                    remotePageUrls.push( url );
                }
            } catch ( exception ){
                // Macrodata could not be resolved, do nothing
            }
        }
                                                              
        return remotePageUrls;
    };
    
    // Add preffix if the URL is not absolute
    var buildURL = function( URL ){
        return URL.startsWith( '/' )? URL: context.getConf().externalMacroPrefixURL + URL;
    };
    
    var loadRemotePages = function( scope, declaredRemotePageUrls, callback, failCallback ){

        var remotePageUrls = buildRemotePageUrlList( scope, declaredRemotePageUrls );
        var pending = remotePageUrls.length;
        remotePages = {};
        
        if ( ! pending ){
            if ( callback && utils.isFunction( callback ) ){
                callback();   
            }
            return;
        }
        
        for ( var c = 0; c < remotePageUrls.length; c++ ) {
            var currentPageUrl = buildURL( remotePageUrls[ c ] );
            
            /* jshint loopfunc: true */
            utils.ajax(
                {
                    url: currentPageUrl,
                    //dataType: 'html',
                    done: function( html ) {
                        var element = document.createElement( 'div' );
                        element.innerHTML = html;
                        remotePages[ this.url ] = element;
                        if ( --pending == 0 && callback && utils.isFunction( callback ) ){
                            callback();
                        }
                    },
                    fail: function( jqXHR, textStatus, error ) {
                        context.asyncError( currentPageUrl, error, failCallback );
                    }
                }
            );
            /*
            $.ajax({
                url: currentPageUrl,
                dataType: 'html'
            }).done( function( html ) {
                var element = $( '<div></div>' );
                element.html( html );
                remotePages[ this.url ] = element;
                if ( --pending == 0 && callback && utils.isFunction( callback ) ){
                    callback();
                }
            }).fail( function( jqXHR, textStatus, error ) {
                context.asyncError( currentPageUrl, error, failCallback );
            });
            */
        }
    };
                  
    var configureNode = function( node, macroId, macroKey ){
        node.removeAttribute( context.getTags().metalDefineMacro );
        node.setAttribute( context.getTags().metalMacro, macroId );
        
        macros[ macroKey ] = node;
        
        return node;
    };
    
    var getMacroKey = function( macroKeyExpression, scope ){
        
        var macroData = getMacroDataUsingExpression( macroKeyExpression, scope );
        
        return macroData.url? macroData.macroId + context.getConf().macroDelimiter + macroData.url: macroData.macroId;
    };
    
    // Must filter to replace : by \\:
    var filterSelector = function( selector ){
        return selector.replace( /:/gi, '\\:' );
    };
    
    return {
        getNode: getNode,
        //isRemote: isRemote,
        loadRemotePages: loadRemotePages,
        getMacroData: getMacroData,
        getMacroKey: getMacroKey,
        filterSelector: filterSelector
    };
})();

},{"./context.js":20,"./expressions/expressionBuilder.js":39,"./utils.js":94}],91:[function(_dereq_,module,exports){
/* 
    ReactiveDictionary class 
*/
"use strict";

var zpt = _dereq_( '../main.js' );

var ReactiveDictionary = function( _nonReactiveDictionary, _initialAutoCommit ) {
    
    // Init some vars
    var self = this;
    this._privateScope = {
        nonReactiveDictionary: _nonReactiveDictionary,
        autoCommit: true,
        dictionaryChanges: {},
        dictionaryActions: [],
        commit: function(){
            zpt.run({
                command: 'update',
                dictionaryChanges: self._privateScope.dictionaryChanges,
                dictionaryActions: self._privateScope.dictionaryActions
            });
            self._privateScope.dictionaryChanges = {};
            self._privateScope.dictionaryActions = [];
        }
    };

    // Define some methods
    this._getNonReactiveDictionary = function(){
        return this._privateScope.nonReactiveDictionary;
    };
    
    this._isAutoCommit = function(){
        return this._privateScope.autoCommit;
    };
    
    this._setAutoCommit = function( _autoCommit ){
        this._privateScope.autoCommit = _autoCommit;
    };
    
    this._commit = function(){
        this._privateScope.commit();
    };

    this._addActions = function( dictionaryActions ){
        
        // Record this actions to commit it later
        self._privateScope.dictionaryActions = self._privateScope.dictionaryActions.concat( dictionaryActions );
        
        // Commit the change only if autoCommit is on
        if ( self._isAutoCommit() ){
            self._privateScope.commit();
        }
    };
    
    this._addVariable = function( key, value ){
        
        // Set the value in nonReactiveDictionary
        self._privateScope.nonReactiveDictionary[ key ] = value;
        
        // Define getter and setter
        this._defineProperty( 
            this._privateScope.nonReactiveDictionary, 
            key 
        );
    };

    this._defineProperty = function( dictionary, key ){

        // Define property to set getter and setter
        Object.defineProperty(
            self, 
            key, 
            {
                enumerable: true,
                configurable: true,
                get: function () { 
                    return dictionary[ key ];
                },
                set: function ( value ) {
                    // Record this change to commit it later
                    self._privateScope.dictionaryChanges[ key ] = value;

                    // Commit the change only if autoCommit is on
                    if ( self._isAutoCommit() ){
                        self._privateScope.commit();
                    }
                }
            }
        );
    };
    
    // Initialize
    this._initialize = function( dictionary ){
        
        // Initialize autoCommit
        if ( _initialAutoCommit !== undefined ){
            this._setAutoCommit( _initialAutoCommit );
        }
        
        // Iterate properties in dictionary to define setters and getters
        var keys = Object.keys( dictionary );
        for ( var i = 0; i < keys.length; i++ ){
            var key = keys[ i ];
            var property = Object.getOwnPropertyDescriptor( dictionary, key );
            if ( property && property.configurable === false ) {
                continue;
            }
            
            // Define getter and setter
            (function( key ) {
                self._defineProperty( dictionary, key );
            })( key );
        }
    };
    this._initialize( this._privateScope.nonReactiveDictionary );
};

module.exports = ReactiveDictionary;

},{"../main.js":68}],92:[function(_dereq_,module,exports){
/* 
    Class Scope 
*/
"use strict";

var context = _dereq_( '../context.js' );
var utils = _dereq_( '../utils.js' );
var loadjs = _dereq_( 'loadjs' );

var Scope = function( _dictionary, _dictionaryExtension, addCommonVars, _folderDictionaries ) {
    
    this.dictionary = _dictionary || {};
    this.dictionaryExtension = _dictionaryExtension || {};
    this.vars = {};
    this.changesStack = [];
    this.nocallVars = {};
    this.folderDictionaries = _folderDictionaries || [];
    this.globalVarsExpressions = {};
    
    if ( addCommonVars ){
        this.setCommonVars();
    }
    this.setMandatoryVars();
};

Scope.prototype.setMandatoryVars = function(){

    // Register nothing var
    this.setVar( 
        context.getConf().nothingVarName, 
        context.getConf().nothingVarValue 
    );
    
    // Register default var
    this.setVar( 
        context.getConf().defaultVarName, 
        context.getConf().defaultVarValue 
    );
};

Scope.prototype.setCommonVars = function(){
    
    // Register window object if it exists
    if ( window ){
        this.setVar( 
            context.getConf().windowVarName, 
            window 
        );
    }

    // Register context
    this.setVar( 
        context.getConf().contextVarName, 
        context 
    );
};

Scope.prototype.startElement = function(){
    
    var vars = {
        varsToUnset: [],
        varsToSet: {},
        expressions: {},
        impliedDeclaredVars: []
    };

    this.changesStack.push( vars );

    return vars;
};

Scope.prototype.currentVars = function(){
    return this.changesStack[ this.changesStack.length - 1 ];
};

Scope.prototype.setVar = function( name, value ) {
    this.vars[ name ] = value;
};

Scope.prototype.getWithoutEvaluating = function( name ) {
    
    var value;
    
    value = this.vars[ name ];
    if ( value !== undefined ){
        return value;
    }
    
    value = this.dictionaryExtension[ name ];
    if ( value !== undefined ){
        return value;
    }
    
    value = this.dictionary[ name ];
    if ( value !== undefined ){
        return value;
    }
    
    for ( var i = 0; i < this.folderDictionaries.length; ++i ){
        value = this.folderDictionaries[ i ][ name ];
        if ( value !== undefined ){
            return value;
        }
    }
    
    return undefined;
};

Scope.prototype.get = function( name ) {

    var value = this.getWithoutEvaluating( name );
    
    if ( ! this.nocallVars[ name ] ){
        return value;
    }
    
    return value && utils.isFunction( value.evaluate )?
        value.evaluate( this ): 
        'Error evaluating property "' + name + '": ' + value;
};

Scope.prototype.unset = function( name ) {
    delete this.vars[ name ];
};

Scope.prototype.endElement = function ( ) {

    var vars = this.changesStack.pop(); 

    var varsToUnset = vars.varsToUnset;
    var varsToSet = vars.varsToSet; 

    for ( var i = 0; i < varsToUnset.length; ++i ){
        this.unset( varsToUnset[ i ] );
    }

    for ( var name in varsToSet ){
        var value = varsToSet[ name ];
        this.setVar( name, value );
    }
};

Scope.prototype.set = function ( name, value, isGlobal, nocall, _expression ) {
    
    var expression = _expression === undefined? null: _expression;
    
    if ( ! isGlobal ){

        // Local vars
        var vars = this.currentVars();
        var currentValue = this.getWithoutEvaluating( name );

        if ( currentValue != null ){
            vars.varsToSet[ name ] = currentValue;
            
        } else {
            vars.varsToUnset.push( name );
        }
        
        vars.expressions[ name ] = expression;
        
        if ( this.isStrictMode() ){
            vars.impliedDeclaredVars.push( name );
        }
        
    } else {
        
        // Global vars
        this.globalVarsExpressions[ name ] = expression; 
    }
    
    // Common to global and local vars
    this.setVar( name, value );
    
    // Add to nocallVars if needed
    if ( nocall ){
        this.nocallVars[ name ] = true;
    }
};

Scope.prototype.loadFolderDictionariesAsync = function ( maxFolderDictionaries, location, callback ) {
    
    if ( ! maxFolderDictionaries ) {
        callback();
        return;
    }
    
    var urlList = this.buildUrlListOfFolderDictionaries( maxFolderDictionaries, location );
    this.loadFolderDictionary(
        maxFolderDictionaries,
        callback,
        urlList, 
        0
    );
};

Scope.prototype.loadFolderDictionary = function ( maxFolderDictionaries, callback, urlList, i ) {
    
    var instance = this;
    
    var loadjsCallback = function( url, success ){
        
        // Treat js file only if load is sucessfull
        if ( success && window.folderDictionary ){
            instance.folderDictionaries.push( window.folderDictionary );
        }
            
        // Run callback and return if the urlList is over
        if ( i === urlList.length){
            callback();
            return;
        }

        // Continue, the urlList is not over
        instance.loadFolderDictionary(
            maxFolderDictionaries, 
            callback,
            urlList, 
            i
        );
    };
    
    var url = urlList[ i++ ];
    loadjs(
        url, 
        {
            success: function() { 
                loadjsCallback( url, true );
            },
            error: function() { 
                loadjsCallback( url, false );
            }
        }
    );
};

Scope.prototype.buildUrlListOfFolderDictionaries = function ( maxFolderDictionaries, location ) {
    
    var result = [];
    
    var c = 0;
    var path = location.pathname;
    var lastIndex = path.lastIndexOf( '/' );
    while ( lastIndex !== -1 && ++c <= maxFolderDictionaries ){
        var parent = path.substr( 0, lastIndex );
        result.push( 
            location.origin + parent + '/' + 'folderDictionary.js' 
        );
        lastIndex = parent.lastIndexOf( '/' );
    }
    
    return result;
};

Scope.prototype.isStrictMode = function(){
    return context.isStrictMode() || this.get( context.getConf().strictModeVarName );
};

Scope.prototype.isValidVariable = function( name ){
    
    // If strict mode is off all variable are valid
    if ( ! this.isStrictMode() ){
        return true;
    }
    
    // If the variable is declared return true
    var declared = this.get( context.getConf().declaredVarsVarName );
    var isDeclared = declared && declared.indexOf? 
        declared.indexOf( name ) !== -1: 
        false;
    if ( isDeclared ){
        return true;
    }
    
    // Check if the variable is implicitly declared
    for ( var i = this.changesStack.length - 1; i >= 0; --i ){
        var vars = this.changesStack[ i ];
        var isImplied = vars.impliedDeclaredVars.indexOf( name ) !== -1;
        if ( isImplied ){
            return true;
        }
    }
    
    return false;
};

Scope.prototype.getVarExpression = function ( name ) {
    
    var expression = this.getExpressionFromLocal( name );
    return expression !== undefined? expression: this.globalVarsExpressions[ name ];
};

Scope.prototype.getExpressionFromLocal = function ( name ) {

    for ( var i = this.changesStack.length - 1; i >= 0; --i ){
        var vars = this.changesStack[ i ];
        var expression = vars.expressions[ name ];
        if ( expression !== undefined ){
            return expression;
        }
    }
    
    return undefined;
};

Scope.prototype.isLocalVar = function ( name ) {
    return this.vars[ name ] !== undefined;
};

module.exports = Scope;

},{"../context.js":20,"../utils.js":94,"loadjs":96}],93:[function(_dereq_,module,exports){
/* 
    scopeBuilder singleton class
*/
"use strict";

var context = _dereq_( '../context.js' );
var Scope = _dereq_( './scope.js' );
var utils = _dereq_( '../utils.js' );
var ParserNodeRenderer = _dereq_( '../parsers/parserNodeRenderer.js' );

module.exports = (function() {
    
    var keyLength = 6;
    
    var build = function( parserOptions, target, dictionaryExtension, mustUpdate ) {

        var scope = new Scope( 
            parserOptions.dictionary, 
            dictionaryExtension, 
            true,
            context.getFolderDictionaries()
        );
        
        if ( mustUpdate ){
            update( parserOptions, target, scope );
        }
        
        return scope;
    };
    
    var update = function( parserOptions, target, scope ) {
        
        // Get root key
        var rootMap = markAllRoots( parserOptions );
        var rootKeyTag = getRootKeyTag();
        var root = getRoot( parserOptions, target, rootMap );
        var rootKey =  root.getAttribute( rootKeyTag );
        
        var talDefineTag = context.getTags().talDefine;
        var talAutoDefineTag = context.getTags().talAutoDefine;
        
        var node = target.parentNode;
        var c = 0;
        var itemsList = [];
        
        do {
            // Add talDefine
            var talDefine = node.getAttribute( talDefineTag );
            if ( talDefine ){
                itemsList.push( talDefine );
            }
            
            // Add talAutoDefine
            var talAutoDefine = node.getAttribute( talAutoDefineTag );
            if ( talAutoDefine ){
                itemsList.push( talAutoDefine );
            }
            
            var nodeKey = node.getAttribute( rootKeyTag );
            if ( nodeKey && nodeKey === rootKey ){
                return processListOfDefines( 
                    scope, 
                    itemsList, 
                    node,
                    parserOptions.indexExpressions
                );
            }
            
            node = node.parentNode;
            
        } while ( node.nodeType !== 9 && ++c < 100 );
        
        throw 'Error trying to update scope: root not found!';
    };
    
    var processListOfDefines = function( scope, itemsList, node, indexExpressions ){
        
        for ( var c = itemsList.length - 1; c >= 0; c-- ) {
            var talDefine = itemsList[ c ];
            ParserNodeRenderer.processDefine(
                node, 
                talDefine, 
                true,
                scope,
                indexExpressions
            );
        }
    };
    
    var getRoot = function( parserOptions, target, rootMap ){
        
        if ( ! Array.isArray( parserOptions.root ) ){ 
            return parserOptions.root;
        }
        
        var rootKeyTag = getRootKeyTag();
        var node = target;
        var c = 0;
        do {
            var rootKey =  node.getAttribute( rootKeyTag );
            if ( rootKey ){
                return rootMap[ rootKey ];
            }

            node = node.parentNode;

        } while ( node.nodeType !== 9 && ++c < 100 );
        
        throw 'Error trying to get root: not found!';
    };
    
    var markAllRoots = function( parserOptions ){

        var rootMap = {};
        var root = parserOptions.root;

        // Is multiroot?
        if ( Array.isArray( root ) ){ 
            // There are several roots
            for ( var c = 0; c < root.length; c++ ) {
                markAsRoot( root[ c ], rootMap );
            }
        } else {
            // There is only one root
            markAsRoot( root, rootMap );
        }

        return rootMap;
    };
    
    var markAsRoot = function( node, rootMap ){
        
        // Build the key
        var key = buildKey();

        // Put a copy of scope into the cache
        rootMap[ key ] = node;

        // Save the key as an attribute of the node
        node.setAttribute( getRootKeyTag(), key );
    };
    
    var buildKey = function(){
        return utils.generateId( keyLength );
    };
    
    var getRootKeyTag = function(){
        return context.getTags().rootKey;
    };
    
    return {
        build: build
    };
})();

},{"../context.js":20,"../parsers/parserNodeRenderer.js":86,"../utils.js":94,"./scope.js":92}],94:[function(_dereq_,module,exports){
/*
    utils singleton class
*/
module.exports = (function() {
    "use strict";
    
    var generateId = function ( len, _charSet ) {
        
        var charSet = _charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var result = '';
        for ( var i = 0; i < len; i++ ) {
            var pos = Math.floor( Math.random() * charSet.length );
            result += charSet.substring( pos, pos + 1 );
        }
        return result;
    };
    
    //var isArray = Array.isArray;
    
    var isFunction = function isFunction( obj ) {

        // Support: Chrome <=57, Firefox <=52
        // In some browsers, typeof returns "function" for HTML <object> elements
        // (i.e., `typeof document.createElement( "object" ) === "function"`).
        // We don't want to classify *any* DOM node as a function.
        return typeof obj === "function" && typeof obj.nodeType !== "number";
    };
    
    var isPlainObject = function( obj ) {
        var proto, Ctor;

        // Detect obvious negatives
        // Use toString instead of jQuery.type to catch host objects
        if ( !obj || Object.prototype.toString.call( obj ) !== "[object Object]" ) {
            return false;
        }

        proto = getProto( obj );

        // Objects with no prototype (e.g., `Object.create( null )`) are plain
        if ( !proto ) {
            return true;
        }

        // Objects with prototype are plain iff they were constructed by a global Object function
        Ctor = hasOwn.call( proto, "constructor" ) && proto.constructor;
        return typeof Ctor === "function" && fnToString.call( Ctor ) === ObjectFunctionString;
    };
    var getProto = Object.getPrototypeOf;
    var class2type = {};
    var hasOwn = class2type.hasOwnProperty;
    var fnToString = hasOwn.toString;
    var ObjectFunctionString = fnToString.call( Object );
    
    var deepExtend = function( out ) {
        out = out || {};

        for ( var i = 1; i < arguments.length; i++ ) {
            var obj = arguments[ i ];

            if ( ! obj ){
                continue;
            }
            
            for ( var key in obj ) {
                if ( obj.hasOwnProperty( key ) ) {
                    if ( typeof obj[ key ] === 'object' ){
                        out[ key ] = deepExtend( out[ key ], obj[ key ] );
                    } else {
                        out[ key ] = obj[ key ];
                    }
                }
            }
        }

        return out;
    };
    
    var extend = function(out) {
        out = out || {};

        for ( var i = 1; i < arguments.length; i++ ) {
            if ( ! arguments[ i ] ){
                continue;
            }

            for ( var key in arguments[ i ] ) {
                if ( arguments[ i ].hasOwnProperty( key ) ){
                    out[ key ] = arguments[ i ][ key ];
                }
            }
        }

        return out;
    };
    
    var ajax = function( conf ){
        
        // Check conf object
        if ( ! conf ){
            throw 'Error trying to process ajax: no arguments!';
        }
        if ( ! conf.url ){
            throw 'Error trying to process ajax: no URL defined!';
        }
        if ( ! conf.done ){
            throw 'Error trying to process ajax: no done callback defined!';
        }
        
        // Do it!
        var oReq = new window.XMLHttpRequest();
        oReq.addEventListener( 
            'load',
            function(){
                if ( this.status >= 200 && this.status < 400 ) {
                    // Success!
                    conf.done( 
                        conf.parseJSON?
                        JSON.parse( oReq.responseText ):
                        oReq.responseText
                    );
                } else {
                    // We reached our target server, but it returned an error
                    conf.fail( undefined, undefined, this.statusText );
                }
            }
        );
        if ( conf.fail ){
            oReq.addEventListener( 'error', conf.fail );
        }
        oReq.open( 'GET', conf.url );
        oReq.send();
    };
    
    var getJSON = function( conf ){
        
        conf.parseJSON = true;
        ajax( conf );
    };
    
    /*
    var getJSON = function( conf ){
        
        // Check conf object
        if ( ! conf ){
            throw 'Error trying to getJSON: no arguments!';
        }
        if ( ! conf.url ){
            throw 'Error trying to getJSON: no URL defined!';
        }
        if ( ! conf.done ){
            throw 'Error trying to getJSON: no done callback defined!';
        }
        
        // Do it!
        var oReq = new window.XMLHttpRequest();
        oReq.addEventListener( 
            'load',
            function(){
                if ( this.status >= 200 && this.status < 400 ) {
                    // Success!
                    conf.done( 
                        JSON.parse( 
                            oReq.responseText 
                        ) 
                    );
                } else {
                    // We reached our target server, but it returned an error
                    conf.fail( undefined, undefined, this.statusText );
                }
            }
        );
        if ( conf.fail ){
            oReq.addEventListener( 'error', conf.fail );
        }
        oReq.open( 'GET', conf.url );
        oReq.send();
    };
    */
    /*
    var getNodeId = function ( node ){
        return node.getAttribute( context.getTags().id );
    };
    */
    var deepEqual = function( x, y ) {
        return (x && y && typeof x === 'object' && typeof y === 'object') ?
            (Object.keys(x).length === Object.keys(y).length) && Object.keys(x).reduce(function(isEqual, key) {return isEqual && deepEqual(x[key], y[key]);}, true):
            (x === y);
    };
    
    var copyArray = function( arrayToCopy ){
        
        var result = [];
        
        for ( var i = 0; i < arrayToCopy.length; ++i ){
            result.push( arrayToCopy[ i ] );
        }
        
        return result;
    };
    
    var genericToString = function( element ){
    
        if ( element == undefined ){
            return 'undefined';
        }
        
        if ( Array.isArray( element ) ){
            var result = 'Array[ ';
            for ( var i = 0; i < element.length; ++i ){
                var separator = i === 0? '': ', ';
                result += separator + genericToString( element[ i ] );
            }
            result += ' ]';
            return result;
        }
        
        if ( isPlainObject( element ) ){
            return JSON.stringify( element );
        }
        
        // Must be numeric or string
        return element;
    };
    
    return {
        generateId: generateId,
        //isArray: isArray,
        isFunction: isFunction,
        isPlainObject: isPlainObject,
        deepExtend: deepExtend,
        extend: extend,
        getJSON: getJSON,
        ajax: ajax,
        deepEqual: deepEqual,
        copyArray: copyArray,
        genericToString: genericToString
        //getNodeId: getNodeId
    };
})();

},{}],95:[function(_dereq_,module,exports){
// generated by genversion
module.exports = '0.40.6'

},{}],96:[function(_dereq_,module,exports){
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.loadjs = factory();
  }
}(this, function() {
/**
 * Global dependencies.
 * @global {Object} document - DOM
 */

var devnull = function() {},
    bundleIdCache = {},
    bundleResultCache = {},
    bundleCallbackQueue = {};


/**
 * Subscribe to bundle load event.
 * @param {string[]} bundleIds - Bundle ids
 * @param {Function} callbackFn - The callback function
 */
function subscribe(bundleIds, callbackFn) {
  // listify
  bundleIds = bundleIds.push ? bundleIds : [bundleIds];

  var depsNotFound = [],
      i = bundleIds.length,
      numWaiting = i,
      fn,
      bundleId,
      r,
      q;

  // define callback function
  fn = function (bundleId, pathsNotFound) {
    if (pathsNotFound.length) depsNotFound.push(bundleId);

    numWaiting--;
    if (!numWaiting) callbackFn(depsNotFound);
  };

  // register callback
  while (i--) {
    bundleId = bundleIds[i];

    // execute callback if in result cache
    r = bundleResultCache[bundleId];
    if (r) {
      fn(bundleId, r);
      continue;
    }

    // add to callback queue
    q = bundleCallbackQueue[bundleId] = bundleCallbackQueue[bundleId] || [];
    q.push(fn);
  }
}


/**
 * Publish bundle load event.
 * @param {string} bundleId - Bundle id
 * @param {string[]} pathsNotFound - List of files not found
 */
function publish(bundleId, pathsNotFound) {
  // exit if id isn't defined
  if (!bundleId) return;

  var q = bundleCallbackQueue[bundleId];

  // cache result
  bundleResultCache[bundleId] = pathsNotFound;

  // exit if queue is empty
  if (!q) return;

  // empty callback queue
  while (q.length) {
    q[0](bundleId, pathsNotFound);
    q.splice(0, 1);
  }
}


/**
 * Execute callbacks.
 * @param {Object or Function} args - The callback args
 * @param {string[]} depsNotFound - List of dependencies not found
 */
function executeCallbacks(args, depsNotFound) {
  // accept function as argument
  if (args.call) args = {success: args};

  // success and error callbacks
  if (depsNotFound.length) (args.error || devnull)(depsNotFound);
  else (args.success || devnull)(args);
}


/**
 * Load individual file.
 * @param {string} path - The file path
 * @param {Function} callbackFn - The callback function
 */
function loadFile(path, callbackFn, args, numTries) {
  var doc = document,
      async = args.async,
      maxTries = (args.numRetries || 0) + 1,
      beforeCallbackFn = args.before || devnull,
      pathname = path.replace(/[\?|#].*$/, ''),
      pathStripped = path.replace(/^(css|img)!/, ''),
      isLegacyIECss,
      e;

  numTries = numTries || 0;

  if (/(^css!|\.css$)/.test(pathname)) {
    // css
    e = doc.createElement('link');
    e.rel = 'stylesheet';
    e.href = pathStripped;

    // tag IE9+
    isLegacyIECss = 'hideFocus' in e;

    // use preload in IE Edge (to detect load errors)
    if (isLegacyIECss && e.relList) {
      isLegacyIECss = 0;
      e.rel = 'preload';
      e.as = 'style';
    }
  } else if (/(^img!|\.(png|gif|jpg|svg|webp)$)/.test(pathname)) {
    // image
    e = doc.createElement('img');
    e.src = pathStripped;    
  } else {
    // javascript
    e = doc.createElement('script');
    e.src = path;
    e.async = async === undefined ? true : async;
  }

  e.onload = e.onerror = e.onbeforeload = function (ev) {
    var result = ev.type[0];

    // treat empty stylesheets as failures to get around lack of onerror
    // support in IE9-11
    if (isLegacyIECss) {
      try {
        if (!e.sheet.cssText.length) result = 'e';
      } catch (x) {
        // sheets objects created from load errors don't allow access to
        // `cssText` (unless error is Code:18 SecurityError)
        if (x.code != 18) result = 'e';
      }
    }

    // handle retries in case of load failure
    if (result == 'e') {
      // increment counter
      numTries += 1;

      // exit function and try again
      if (numTries < maxTries) {
        return loadFile(path, callbackFn, args, numTries);
      }
    } else if (e.rel == 'preload' && e.as == 'style') {
      // activate preloaded stylesheets
      return e.rel = 'stylesheet'; // jshint ignore:line
    }
    
    // execute callback
    callbackFn(path, result, ev.defaultPrevented);
  };

  // add to document (unless callback returns `false`)
  if (beforeCallbackFn(path, e) !== false) doc.head.appendChild(e);
}


/**
 * Load multiple files.
 * @param {string[]} paths - The file paths
 * @param {Function} callbackFn - The callback function
 */
function loadFiles(paths, callbackFn, args) {
  // listify paths
  paths = paths.push ? paths : [paths];

  var numWaiting = paths.length,
      x = numWaiting,
      pathsNotFound = [],
      fn,
      i;

  // define callback function
  fn = function(path, result, defaultPrevented) {
    // handle error
    if (result == 'e') pathsNotFound.push(path);

    // handle beforeload event. If defaultPrevented then that means the load
    // will be blocked (ex. Ghostery/ABP on Safari)
    if (result == 'b') {
      if (defaultPrevented) pathsNotFound.push(path);
      else return;
    }

    numWaiting--;
    if (!numWaiting) callbackFn(pathsNotFound);
  };

  // load scripts
  for (i=0; i < x; i++) loadFile(paths[i], fn, args);
}


/**
 * Initiate script load and register bundle.
 * @param {(string|string[])} paths - The file paths
 * @param {(string|Function|Object)} [arg1] - The (1) bundleId or (2) success
 *   callback or (3) object literal with success/error arguments, numRetries,
 *   etc.
 * @param {(Function|Object)} [arg2] - The (1) success callback or (2) object
 *   literal with success/error arguments, numRetries, etc.
 */
function loadjs(paths, arg1, arg2) {
  var bundleId,
      args;

  // bundleId (if string)
  if (arg1 && arg1.trim) bundleId = arg1;

  // args (default is {})
  args = (bundleId ? arg2 : arg1) || {};

  // throw error if bundle is already defined
  if (bundleId) {
    if (bundleId in bundleIdCache) {
      throw "LoadJS";
    } else {
      bundleIdCache[bundleId] = true;
    }
  }

  function loadFn(resolve, reject) {
    loadFiles(paths, function (pathsNotFound) {
      // execute callbacks
      executeCallbacks(args, pathsNotFound);
      
      // resolve Promise
      if (resolve) {
        executeCallbacks({success: resolve, error: reject}, pathsNotFound);
      }

      // publish bundle load event
      publish(bundleId, pathsNotFound);
    }, args);
  }
  
  if (args.returnPromise) return new Promise(loadFn);
  else loadFn();
}


/**
 * Execute callbacks when dependencies have been satisfied.
 * @param {(string|string[])} deps - List of bundle ids
 * @param {Object} args - success/error arguments
 */
loadjs.ready = function ready(deps, args) {
  // subscribe to bundle load event
  subscribe(deps, function (depsNotFound) {
    // execute callbacks
    executeCallbacks(args, depsNotFound);
  });

  return loadjs;
};


/**
 * Manually satisfy bundle dependencies.
 * @param {string} bundleId - The bundle id
 */
loadjs.done = function done(bundleId) {
  publish(bundleId, []);
};


/**
 * Reset loadjs dependencies statuses
 */
loadjs.reset = function reset() {
  bundleIdCache = {};
  bundleResultCache = {};
  bundleCallbackQueue = {};
};


/**
 * Determine if bundle has already been defined
 * @param String} bundleId - The bundle id
 */
loadjs.isDefined = function isDefined(bundleId) {
  return bundleId in bundleIdCache;
};


// export
return loadjs;

}));

},{}],97:[function(_dereq_,module,exports){
/**
 * Copyright 2015 Tim Down.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


(function(factory,root){if(typeof define=="function"&&define.amd){define(factory);}else if(typeof module!="undefined"&&typeof exports=="object"){module.exports=factory();}else{root.log4javascript=factory();}})(function(){if(!Array.prototype.push){Array.prototype.push=function(){for(var i=0,len=arguments.length;i<len;i++){this[this.length]=arguments[i];}
return this.length;};}
if(!Array.prototype.shift){Array.prototype.shift=function(){if(this.length>0){var firstItem=this[0];for(var i=0,len=this.length-1;i<len;i++){this[i]=this[i+1];}
this.length=this.length-1;return firstItem;}};}
if(!Array.prototype.splice){Array.prototype.splice=function(startIndex,deleteCount){var itemsAfterDeleted=this.slice(startIndex+deleteCount);var itemsDeleted=this.slice(startIndex,startIndex+deleteCount);this.length=startIndex;var argumentsArray=[];for(var i=0,len=arguments.length;i<len;i++){argumentsArray[i]=arguments[i];}
var itemsToAppend=(argumentsArray.length>2)?itemsAfterDeleted=argumentsArray.slice(2).concat(itemsAfterDeleted):itemsAfterDeleted;for(i=0,len=itemsToAppend.length;i<len;i++){this.push(itemsToAppend[i]);}
return itemsDeleted;};}
function isUndefined(obj){return typeof obj=="undefined";}
function EventSupport(){}
EventSupport.prototype={eventTypes:[],eventListeners:{},setEventTypes:function(eventTypesParam){if(eventTypesParam instanceof Array){this.eventTypes=eventTypesParam;this.eventListeners={};for(var i=0,len=this.eventTypes.length;i<len;i++){this.eventListeners[this.eventTypes[i]]=[];}}else{handleError("log4javascript.EventSupport ["+this+"]: setEventTypes: eventTypes parameter must be an Array");}},addEventListener:function(eventType,listener){if(typeof listener=="function"){if(!array_contains(this.eventTypes,eventType)){handleError("log4javascript.EventSupport ["+this+"]: addEventListener: no event called '"+eventType+"'");}
this.eventListeners[eventType].push(listener);}else{handleError("log4javascript.EventSupport ["+this+"]: addEventListener: listener must be a function");}},removeEventListener:function(eventType,listener){if(typeof listener=="function"){if(!array_contains(this.eventTypes,eventType)){handleError("log4javascript.EventSupport ["+this+"]: removeEventListener: no event called '"+eventType+"'");}
array_remove(this.eventListeners[eventType],listener);}else{handleError("log4javascript.EventSupport ["+this+"]: removeEventListener: listener must be a function");}},dispatchEvent:function(eventType,eventArgs){if(array_contains(this.eventTypes,eventType)){var listeners=this.eventListeners[eventType];for(var i=0,len=listeners.length;i<len;i++){listeners[i](this,eventType,eventArgs);}}else{handleError("log4javascript.EventSupport ["+this+"]: dispatchEvent: no event called '"+eventType+"'");}}};var applicationStartDate=new Date();var uniqueId="log4javascript_"+applicationStartDate.getTime()+"_"+
Math.floor(Math.random()*100000000);var emptyFunction=function(){};var newLine="\r\n";var pageLoaded=false;function Log4JavaScript(){}
Log4JavaScript.prototype=new EventSupport();var log4javascript=new Log4JavaScript();log4javascript.version="1.4.13";log4javascript.edition="log4javascript";function toStr(obj){if(obj&&obj.toString){return obj.toString();}else{return String(obj);}}
function getExceptionMessage(ex){if(ex.message){return ex.message;}else if(ex.description){return ex.description;}else{return toStr(ex);}}
function getUrlFileName(url){var lastSlashIndex=Math.max(url.lastIndexOf("/"),url.lastIndexOf("\\"));return url.substr(lastSlashIndex+1);}
function getExceptionStringRep(ex){if(ex){var exStr="Exception: "+getExceptionMessage(ex);try{if(ex.lineNumber){exStr+=" on line number "+ex.lineNumber;}
if(ex.fileName){exStr+=" in file "+getUrlFileName(ex.fileName);}}catch(localEx){logLog.warn("Unable to obtain file and line information for error");}
if(showStackTraces&&ex.stack){exStr+=newLine+"Stack trace:"+newLine+ex.stack;}
return exStr;}
return null;}
function bool(obj){return Boolean(obj);}
function trim(str){return str.replace(/^\s+/,"").replace(/\s+$/,"");}
function splitIntoLines(text){var text2=text.replace(/\r\n/g,"\n").replace(/\r/g,"\n");return text2.split("\n");}
var urlEncode=(typeof window.encodeURIComponent!="undefined")?function(str){return encodeURIComponent(str);}:function(str){return escape(str).replace(/\+/g,"%2B").replace(/"/g,"%22").replace(/'/g,"%27").replace(/\//g,"%2F").replace(/=/g,"%3D");};function array_remove(arr,val){var index=-1;for(var i=0,len=arr.length;i<len;i++){if(arr[i]===val){index=i;break;}}
if(index>=0){arr.splice(index,1);return true;}else{return false;}}
function array_contains(arr,val){for(var i=0,len=arr.length;i<len;i++){if(arr[i]==val){return true;}}
return false;}
function extractBooleanFromParam(param,defaultValue){if(isUndefined(param)){return defaultValue;}else{return bool(param);}}
function extractStringFromParam(param,defaultValue){if(isUndefined(param)){return defaultValue;}else{return String(param);}}
function extractIntFromParam(param,defaultValue){if(isUndefined(param)){return defaultValue;}else{try{var value=parseInt(param,10);return isNaN(value)?defaultValue:value;}catch(ex){logLog.warn("Invalid int param "+param,ex);return defaultValue;}}}
function extractFunctionFromParam(param,defaultValue){if(typeof param=="function"){return param;}else{return defaultValue;}}
function isError(err){return(err instanceof Error);}
if(!Function.prototype.apply){Function.prototype.apply=function(obj,args){var methodName="__apply__";if(typeof obj[methodName]!="undefined"){methodName+=String(Math.random()).substr(2);}
obj[methodName]=this;var argsStrings=[];for(var i=0,len=args.length;i<len;i++){argsStrings[i]="args["+i+"]";}
var script="obj."+methodName+"("+argsStrings.join(",")+")";var returnValue=eval(script);delete obj[methodName];return returnValue;};}
if(!Function.prototype.call){Function.prototype.call=function(obj){var args=[];for(var i=1,len=arguments.length;i<len;i++){args[i-1]=arguments[i];}
return this.apply(obj,args);};}
var logLog={quietMode:false,debugMessages:[],setQuietMode:function(quietMode){this.quietMode=bool(quietMode);},numberOfErrors:0,alertAllErrors:false,setAlertAllErrors:function(alertAllErrors){this.alertAllErrors=alertAllErrors;},debug:function(message){this.debugMessages.push(message);},displayDebug:function(){alert(this.debugMessages.join(newLine));},warn:function(message,exception){},error:function(message,exception){if(++this.numberOfErrors==1||this.alertAllErrors){if(!this.quietMode){var alertMessage="log4javascript error: "+message;if(exception){alertMessage+=newLine+newLine+"Original error: "+getExceptionStringRep(exception);}
alert(alertMessage);}}}};log4javascript.logLog=logLog;log4javascript.setEventTypes(["load","error"]);function handleError(message,exception){logLog.error(message,exception);log4javascript.dispatchEvent("error",{"message":message,"exception":exception});}
log4javascript.handleError=handleError;var enabled=!((typeof log4javascript_disabled!="undefined")&&log4javascript_disabled);log4javascript.setEnabled=function(enable){enabled=bool(enable);};log4javascript.isEnabled=function(){return enabled;};var useTimeStampsInMilliseconds=true;log4javascript.setTimeStampsInMilliseconds=function(timeStampsInMilliseconds){useTimeStampsInMilliseconds=bool(timeStampsInMilliseconds);};log4javascript.isTimeStampsInMilliseconds=function(){return useTimeStampsInMilliseconds;};log4javascript.evalInScope=function(expr){return eval(expr);};var showStackTraces=false;log4javascript.setShowStackTraces=function(show){showStackTraces=bool(show);};var Level=function(level,name){this.level=level;this.name=name;};Level.prototype={toString:function(){return this.name;},equals:function(level){return this.level==level.level;},isGreaterOrEqual:function(level){return this.level>=level.level;}};Level.ALL=new Level(Number.MIN_VALUE,"ALL");Level.TRACE=new Level(10000,"TRACE");Level.DEBUG=new Level(20000,"DEBUG");Level.INFO=new Level(30000,"INFO");Level.WARN=new Level(40000,"WARN");Level.ERROR=new Level(50000,"ERROR");Level.FATAL=new Level(60000,"FATAL");Level.OFF=new Level(Number.MAX_VALUE,"OFF");log4javascript.Level=Level;function Timer(name,level){this.name=name;this.level=isUndefined(level)?Level.INFO:level;this.start=new Date();}
Timer.prototype.getElapsedTime=function(){return new Date().getTime()-this.start.getTime();};var anonymousLoggerName="[anonymous]";var defaultLoggerName="[default]";var nullLoggerName="[null]";var rootLoggerName="root";function Logger(name){this.name=name;this.parent=null;this.children=[];var appenders=[];var loggerLevel=null;var isRoot=(this.name===rootLoggerName);var isNull=(this.name===nullLoggerName);var appenderCache=null;var appenderCacheInvalidated=false;this.addChild=function(childLogger){this.children.push(childLogger);childLogger.parent=this;childLogger.invalidateAppenderCache();};var additive=true;this.getAdditivity=function(){return additive;};this.setAdditivity=function(additivity){var valueChanged=(additive!=additivity);additive=additivity;if(valueChanged){this.invalidateAppenderCache();}};this.addAppender=function(appender){if(isNull){handleError("Logger.addAppender: you may not add an appender to the null logger");}else{if(appender instanceof log4javascript.Appender){if(!array_contains(appenders,appender)){appenders.push(appender);appender.setAddedToLogger(this);this.invalidateAppenderCache();}}else{handleError("Logger.addAppender: appender supplied ('"+
toStr(appender)+"') is not a subclass of Appender");}}};this.removeAppender=function(appender){array_remove(appenders,appender);appender.setRemovedFromLogger(this);this.invalidateAppenderCache();};this.removeAllAppenders=function(){var appenderCount=appenders.length;if(appenderCount>0){for(var i=0;i<appenderCount;i++){appenders[i].setRemovedFromLogger(this);}
appenders.length=0;this.invalidateAppenderCache();}};this.getEffectiveAppenders=function(){if(appenderCache===null||appenderCacheInvalidated){var parentEffectiveAppenders=(isRoot||!this.getAdditivity())?[]:this.parent.getEffectiveAppenders();appenderCache=parentEffectiveAppenders.concat(appenders);appenderCacheInvalidated=false;}
return appenderCache;};this.invalidateAppenderCache=function(){appenderCacheInvalidated=true;for(var i=0,len=this.children.length;i<len;i++){this.children[i].invalidateAppenderCache();}};this.log=function(level,params){if(enabled&&level.isGreaterOrEqual(this.getEffectiveLevel())){var exception;var finalParamIndex=params.length-1;var lastParam=params[finalParamIndex];if(params.length>1&&isError(lastParam)){exception=lastParam;finalParamIndex--;}
var messages=[];for(var i=0;i<=finalParamIndex;i++){messages[i]=params[i];}
var loggingEvent=new LoggingEvent(this,new Date(),level,messages,exception);this.callAppenders(loggingEvent);}};this.callAppenders=function(loggingEvent){var effectiveAppenders=this.getEffectiveAppenders();for(var i=0,len=effectiveAppenders.length;i<len;i++){effectiveAppenders[i].doAppend(loggingEvent);}};this.setLevel=function(level){if(isRoot&&level===null){handleError("Logger.setLevel: you cannot set the level of the root logger to null");}else if(level instanceof Level){loggerLevel=level;}else{handleError("Logger.setLevel: level supplied to logger "+
this.name+" is not an instance of log4javascript.Level");}};this.getLevel=function(){return loggerLevel;};this.getEffectiveLevel=function(){for(var logger=this;logger!==null;logger=logger.parent){var level=logger.getLevel();if(level!==null){return level;}}};this.group=function(name,initiallyExpanded){if(enabled){var effectiveAppenders=this.getEffectiveAppenders();for(var i=0,len=effectiveAppenders.length;i<len;i++){effectiveAppenders[i].group(name,initiallyExpanded);}}};this.groupEnd=function(){if(enabled){var effectiveAppenders=this.getEffectiveAppenders();for(var i=0,len=effectiveAppenders.length;i<len;i++){effectiveAppenders[i].groupEnd();}}};var timers={};this.time=function(name,level){if(enabled){if(isUndefined(name)){handleError("Logger.time: a name for the timer must be supplied");}else if(level&&!(level instanceof Level)){handleError("Logger.time: level supplied to timer "+
name+" is not an instance of log4javascript.Level");}else{timers[name]=new Timer(name,level);}}};this.timeEnd=function(name){if(enabled){if(isUndefined(name)){handleError("Logger.timeEnd: a name for the timer must be supplied");}else if(timers[name]){var timer=timers[name];var milliseconds=timer.getElapsedTime();this.log(timer.level,["Timer "+toStr(name)+" completed in "+milliseconds+"ms"]);delete timers[name];}else{logLog.warn("Logger.timeEnd: no timer found with name "+name);}}};this.assert=function(expr){if(enabled&&!expr){var args=[];for(var i=1,len=arguments.length;i<len;i++){args.push(arguments[i]);}
args=(args.length>0)?args:["Assertion Failure"];args.push(newLine);args.push(expr);this.log(Level.ERROR,args);}};this.toString=function(){return"Logger["+this.name+"]";};}
Logger.prototype={trace:function(){this.log(Level.TRACE,arguments);},debug:function(){this.log(Level.DEBUG,arguments);},info:function(){this.log(Level.INFO,arguments);},warn:function(){this.log(Level.WARN,arguments);},error:function(){this.log(Level.ERROR,arguments);},fatal:function(){this.log(Level.FATAL,arguments);},isEnabledFor:function(level){return level.isGreaterOrEqual(this.getEffectiveLevel());},isTraceEnabled:function(){return this.isEnabledFor(Level.TRACE);},isDebugEnabled:function(){return this.isEnabledFor(Level.DEBUG);},isInfoEnabled:function(){return this.isEnabledFor(Level.INFO);},isWarnEnabled:function(){return this.isEnabledFor(Level.WARN);},isErrorEnabled:function(){return this.isEnabledFor(Level.ERROR);},isFatalEnabled:function(){return this.isEnabledFor(Level.FATAL);}};Logger.prototype.trace.isEntryPoint=true;Logger.prototype.debug.isEntryPoint=true;Logger.prototype.info.isEntryPoint=true;Logger.prototype.warn.isEntryPoint=true;Logger.prototype.error.isEntryPoint=true;Logger.prototype.fatal.isEntryPoint=true;var loggers={};var loggerNames=[];var ROOT_LOGGER_DEFAULT_LEVEL=Level.DEBUG;var rootLogger=new Logger(rootLoggerName);rootLogger.setLevel(ROOT_LOGGER_DEFAULT_LEVEL);log4javascript.getRootLogger=function(){return rootLogger;};log4javascript.getLogger=function(loggerName){if(typeof loggerName!="string"){loggerName=anonymousLoggerName;logLog.warn("log4javascript.getLogger: non-string logger name "+
toStr(loggerName)+" supplied, returning anonymous logger");}
if(loggerName==rootLoggerName){handleError("log4javascript.getLogger: root logger may not be obtained by name");}
if(!loggers[loggerName]){var logger=new Logger(loggerName);loggers[loggerName]=logger;loggerNames.push(loggerName);var lastDotIndex=loggerName.lastIndexOf(".");var parentLogger;if(lastDotIndex>-1){var parentLoggerName=loggerName.substring(0,lastDotIndex);parentLogger=log4javascript.getLogger(parentLoggerName);}else{parentLogger=rootLogger;}
parentLogger.addChild(logger);}
return loggers[loggerName];};var defaultLogger=null;log4javascript.getDefaultLogger=function(){if(!defaultLogger){defaultLogger=createDefaultLogger();}
return defaultLogger;};var nullLogger=null;log4javascript.getNullLogger=function(){if(!nullLogger){nullLogger=new Logger(nullLoggerName);nullLogger.setLevel(Level.OFF);}
return nullLogger;};log4javascript.resetConfiguration=function(){rootLogger.setLevel(ROOT_LOGGER_DEFAULT_LEVEL);loggers={};};var LoggingEvent=function(logger,timeStamp,level,messages,exception){this.logger=logger;this.timeStamp=timeStamp;this.timeStampInMilliseconds=timeStamp.getTime();this.timeStampInSeconds=Math.floor(this.timeStampInMilliseconds/1000);this.milliseconds=this.timeStamp.getMilliseconds();this.level=level;this.messages=messages;this.exception=exception;};LoggingEvent.prototype={getThrowableStrRep:function(){return this.exception?getExceptionStringRep(this.exception):"";},getCombinedMessages:function(){return(this.messages.length==1)?this.messages[0]:this.messages.join(newLine);},toString:function(){return"LoggingEvent["+this.level+"]";}};log4javascript.LoggingEvent=LoggingEvent;var Layout=function(){};Layout.prototype={defaults:{loggerKey:"logger",timeStampKey:"timestamp",millisecondsKey:"milliseconds",levelKey:"level",messageKey:"message",exceptionKey:"exception",urlKey:"url"},loggerKey:"logger",timeStampKey:"timestamp",millisecondsKey:"milliseconds",levelKey:"level",messageKey:"message",exceptionKey:"exception",urlKey:"url",batchHeader:"",batchFooter:"",batchSeparator:"",returnsPostData:false,overrideTimeStampsSetting:false,useTimeStampsInMilliseconds:null,format:function(){handleError("Layout.format: layout supplied has no format() method");},ignoresThrowable:function(){handleError("Layout.ignoresThrowable: layout supplied has no ignoresThrowable() method");},getContentType:function(){return"text/plain";},allowBatching:function(){return true;},setTimeStampsInMilliseconds:function(timeStampsInMilliseconds){this.overrideTimeStampsSetting=true;this.useTimeStampsInMilliseconds=bool(timeStampsInMilliseconds);},isTimeStampsInMilliseconds:function(){return this.overrideTimeStampsSetting?this.useTimeStampsInMilliseconds:useTimeStampsInMilliseconds;},getTimeStampValue:function(loggingEvent){return this.isTimeStampsInMilliseconds()?loggingEvent.timeStampInMilliseconds:loggingEvent.timeStampInSeconds;},getDataValues:function(loggingEvent,combineMessages){var dataValues=[[this.loggerKey,loggingEvent.logger.name],[this.timeStampKey,this.getTimeStampValue(loggingEvent)],[this.levelKey,loggingEvent.level.name],[this.urlKey,window.location.href],[this.messageKey,combineMessages?loggingEvent.getCombinedMessages():loggingEvent.messages]];if(!this.isTimeStampsInMilliseconds()){dataValues.push([this.millisecondsKey,loggingEvent.milliseconds]);}
if(loggingEvent.exception){dataValues.push([this.exceptionKey,getExceptionStringRep(loggingEvent.exception)]);}
if(this.hasCustomFields()){for(var i=0,len=this.customFields.length;i<len;i++){var val=this.customFields[i].value;if(typeof val==="function"){val=val(this,loggingEvent);}
dataValues.push([this.customFields[i].name,val]);}}
return dataValues;},setKeys:function(loggerKey,timeStampKey,levelKey,messageKey,exceptionKey,urlKey,millisecondsKey){this.loggerKey=extractStringFromParam(loggerKey,this.defaults.loggerKey);this.timeStampKey=extractStringFromParam(timeStampKey,this.defaults.timeStampKey);this.levelKey=extractStringFromParam(levelKey,this.defaults.levelKey);this.messageKey=extractStringFromParam(messageKey,this.defaults.messageKey);this.exceptionKey=extractStringFromParam(exceptionKey,this.defaults.exceptionKey);this.urlKey=extractStringFromParam(urlKey,this.defaults.urlKey);this.millisecondsKey=extractStringFromParam(millisecondsKey,this.defaults.millisecondsKey);},setCustomField:function(name,value){var fieldUpdated=false;for(var i=0,len=this.customFields.length;i<len;i++){if(this.customFields[i].name===name){this.customFields[i].value=value;fieldUpdated=true;}}
if(!fieldUpdated){this.customFields.push({"name":name,"value":value});}},hasCustomFields:function(){return(this.customFields.length>0);},formatWithException:function(loggingEvent){var formatted=this.format(loggingEvent);if(loggingEvent.exception&&this.ignoresThrowable()){formatted+=loggingEvent.getThrowableStrRep();}
return formatted;},toString:function(){handleError("Layout.toString: all layouts must override this method");}};log4javascript.Layout=Layout;var Appender=function(){};Appender.prototype=new EventSupport();Appender.prototype.layout=new PatternLayout();Appender.prototype.threshold=Level.ALL;Appender.prototype.loggers=[];Appender.prototype.doAppend=function(loggingEvent){if(enabled&&loggingEvent.level.level>=this.threshold.level){this.append(loggingEvent);}};Appender.prototype.append=function(loggingEvent){};Appender.prototype.setLayout=function(layout){if(layout instanceof Layout){this.layout=layout;}else{handleError("Appender.setLayout: layout supplied to "+
this.toString()+" is not a subclass of Layout");}};Appender.prototype.getLayout=function(){return this.layout;};Appender.prototype.setThreshold=function(threshold){if(threshold instanceof Level){this.threshold=threshold;}else{handleError("Appender.setThreshold: threshold supplied to "+
this.toString()+" is not a subclass of Level");}};Appender.prototype.getThreshold=function(){return this.threshold;};Appender.prototype.setAddedToLogger=function(logger){this.loggers.push(logger);};Appender.prototype.setRemovedFromLogger=function(logger){array_remove(this.loggers,logger);};Appender.prototype.group=emptyFunction;Appender.prototype.groupEnd=emptyFunction;Appender.prototype.toString=function(){handleError("Appender.toString: all appenders must override this method");};log4javascript.Appender=Appender;function SimpleLayout(){this.customFields=[];}
SimpleLayout.prototype=new Layout();SimpleLayout.prototype.format=function(loggingEvent){return loggingEvent.level.name+" - "+loggingEvent.getCombinedMessages();};SimpleLayout.prototype.ignoresThrowable=function(){return true;};SimpleLayout.prototype.toString=function(){return"SimpleLayout";};log4javascript.SimpleLayout=SimpleLayout;function NullLayout(){this.customFields=[];}
NullLayout.prototype=new Layout();NullLayout.prototype.format=function(loggingEvent){return loggingEvent.messages;};NullLayout.prototype.ignoresThrowable=function(){return true;};NullLayout.prototype.formatWithException=function(loggingEvent){var messages=loggingEvent.messages,ex=loggingEvent.exception;return ex?messages.concat([ex]):messages;};NullLayout.prototype.toString=function(){return"NullLayout";};log4javascript.NullLayout=NullLayout;function XmlLayout(combineMessages){this.combineMessages=extractBooleanFromParam(combineMessages,true);this.customFields=[];}
XmlLayout.prototype=new Layout();XmlLayout.prototype.isCombinedMessages=function(){return this.combineMessages;};XmlLayout.prototype.getContentType=function(){return"text/xml";};XmlLayout.prototype.escapeCdata=function(str){return str.replace(/\]\]>/,"]]>]]&gt;<![CDATA[");};XmlLayout.prototype.format=function(loggingEvent){var layout=this;var i,len;function formatMessage(message){message=(typeof message==="string")?message:toStr(message);return"<log4javascript:message><![CDATA["+
layout.escapeCdata(message)+"]]></log4javascript:message>";}
var str="<log4javascript:event logger=\""+loggingEvent.logger.name+"\" timestamp=\""+this.getTimeStampValue(loggingEvent)+"\"";if(!this.isTimeStampsInMilliseconds()){str+=" milliseconds=\""+loggingEvent.milliseconds+"\"";}
str+=" level=\""+loggingEvent.level.name+"\">"+newLine;if(this.combineMessages){str+=formatMessage(loggingEvent.getCombinedMessages());}else{str+="<log4javascript:messages>"+newLine;for(i=0,len=loggingEvent.messages.length;i<len;i++){str+=formatMessage(loggingEvent.messages[i])+newLine;}
str+="</log4javascript:messages>"+newLine;}
if(this.hasCustomFields()){for(i=0,len=this.customFields.length;i<len;i++){str+="<log4javascript:customfield name=\""+
this.customFields[i].name+"\"><![CDATA["+
this.customFields[i].value.toString()+"]]></log4javascript:customfield>"+newLine;}}
if(loggingEvent.exception){str+="<log4javascript:exception><![CDATA["+
getExceptionStringRep(loggingEvent.exception)+"]]></log4javascript:exception>"+newLine;}
str+="</log4javascript:event>"+newLine+newLine;return str;};XmlLayout.prototype.ignoresThrowable=function(){return false;};XmlLayout.prototype.toString=function(){return"XmlLayout";};log4javascript.XmlLayout=XmlLayout;function escapeNewLines(str){return str.replace(/\r\n|\r|\n/g,"\\r\\n");}
function JsonLayout(readable,combineMessages){this.readable=extractBooleanFromParam(readable,false);this.combineMessages=extractBooleanFromParam(combineMessages,true);this.batchHeader=this.readable?"["+newLine:"[";this.batchFooter=this.readable?"]"+newLine:"]";this.batchSeparator=this.readable?","+newLine:",";this.setKeys();this.colon=this.readable?": ":":";this.tab=this.readable?"\t":"";this.lineBreak=this.readable?newLine:"";this.customFields=[];}
JsonLayout.prototype=new Layout();JsonLayout.prototype.isReadable=function(){return this.readable;};JsonLayout.prototype.isCombinedMessages=function(){return this.combineMessages;};JsonLayout.prototype.format=function(loggingEvent){var layout=this;var dataValues=this.getDataValues(loggingEvent,this.combineMessages);var str="{"+this.lineBreak;var i,len;function formatValue(val,prefix,expand){var formattedValue;var valType=typeof val;if(val instanceof Date){formattedValue=String(val.getTime());}else if(expand&&(val instanceof Array)){formattedValue="["+layout.lineBreak;for(var i=0,len=val.length;i<len;i++){var childPrefix=prefix+layout.tab;formattedValue+=childPrefix+formatValue(val[i],childPrefix,false);if(i<val.length-1){formattedValue+=",";}
formattedValue+=layout.lineBreak;}
formattedValue+=prefix+"]";}else if(valType!=="number"&&valType!=="boolean"){formattedValue="\""+escapeNewLines(toStr(val).replace(/\"/g,"\\\""))+"\"";}else{formattedValue=val;}
return formattedValue;}
for(i=0,len=dataValues.length-1;i<=len;i++){str+=this.tab+"\""+dataValues[i][0]+"\""+this.colon+formatValue(dataValues[i][1],this.tab,true);if(i<len){str+=",";}
str+=this.lineBreak;}
str+="}"+this.lineBreak;return str;};JsonLayout.prototype.ignoresThrowable=function(){return false;};JsonLayout.prototype.toString=function(){return"JsonLayout";};JsonLayout.prototype.getContentType=function(){return"application/json";};log4javascript.JsonLayout=JsonLayout;function HttpPostDataLayout(){this.setKeys();this.customFields=[];this.returnsPostData=true;}
HttpPostDataLayout.prototype=new Layout();HttpPostDataLayout.prototype.allowBatching=function(){return false;};HttpPostDataLayout.prototype.format=function(loggingEvent){var dataValues=this.getDataValues(loggingEvent);var queryBits=[];for(var i=0,len=dataValues.length;i<len;i++){var val=(dataValues[i][1]instanceof Date)?String(dataValues[i][1].getTime()):dataValues[i][1];queryBits.push(urlEncode(dataValues[i][0])+"="+urlEncode(val));}
return queryBits.join("&");};HttpPostDataLayout.prototype.ignoresThrowable=function(loggingEvent){return false;};HttpPostDataLayout.prototype.toString=function(){return"HttpPostDataLayout";};log4javascript.HttpPostDataLayout=HttpPostDataLayout;function formatObjectExpansion(obj,depth,indentation){var objectsExpanded=[];function doFormat(obj,depth,indentation){var i,len,childDepth,childIndentation,childLines,expansion,childExpansion;if(!indentation){indentation="";}
function formatString(text){var lines=splitIntoLines(text);for(var j=1,jLen=lines.length;j<jLen;j++){lines[j]=indentation+lines[j];}
return lines.join(newLine);}
if(obj===null){return"null";}else if(typeof obj=="undefined"){return"undefined";}else if(typeof obj=="string"){return formatString(obj);}else if(typeof obj=="object"&&array_contains(objectsExpanded,obj)){try{expansion=toStr(obj);}catch(ex){expansion="Error formatting property. Details: "+getExceptionStringRep(ex);}
return expansion+" [already expanded]";}else if((obj instanceof Array)&&depth>0){objectsExpanded.push(obj);expansion="["+newLine;childDepth=depth-1;childIndentation=indentation+"  ";childLines=[];for(i=0,len=obj.length;i<len;i++){try{childExpansion=doFormat(obj[i],childDepth,childIndentation);childLines.push(childIndentation+childExpansion);}catch(ex){childLines.push(childIndentation+"Error formatting array member. Details: "+
getExceptionStringRep(ex)+"");}}
expansion+=childLines.join(","+newLine)+newLine+indentation+"]";return expansion;}else if(Object.prototype.toString.call(obj)=="[object Date]"){return obj.toString();}else if(typeof obj=="object"&&depth>0){objectsExpanded.push(obj);expansion="{"+newLine;childDepth=depth-1;childIndentation=indentation+"  ";childLines=[];for(i in obj){try{childExpansion=doFormat(obj[i],childDepth,childIndentation);childLines.push(childIndentation+i+": "+childExpansion);}catch(ex){childLines.push(childIndentation+i+": Error formatting property. Details: "+
getExceptionStringRep(ex));}}
expansion+=childLines.join(","+newLine)+newLine+indentation+"}";return expansion;}else{return formatString(toStr(obj));}}
return doFormat(obj,depth,indentation);}
var SimpleDateFormat;(function(){var regex=/('[^']*')|(G+|y+|M+|w+|W+|D+|d+|F+|E+|a+|H+|k+|K+|h+|m+|s+|S+|Z+)|([a-zA-Z]+)|([^a-zA-Z']+)/;var monthNames=["January","February","March","April","May","June","July","August","September","October","November","December"];var dayNames=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];var TEXT2=0,TEXT3=1,NUMBER=2,YEAR=3,MONTH=4,TIMEZONE=5;var types={G:TEXT2,y:YEAR,M:MONTH,w:NUMBER,W:NUMBER,D:NUMBER,d:NUMBER,F:NUMBER,E:TEXT3,a:TEXT2,H:NUMBER,k:NUMBER,K:NUMBER,h:NUMBER,m:NUMBER,s:NUMBER,S:NUMBER,Z:TIMEZONE};var ONE_DAY=24*60*60*1000;var ONE_WEEK=7*ONE_DAY;var DEFAULT_MINIMAL_DAYS_IN_FIRST_WEEK=1;var newDateAtMidnight=function(year,month,day){var d=new Date(year,month,day,0,0,0);d.setMilliseconds(0);return d;};Date.prototype.getDifference=function(date){return this.getTime()-date.getTime();};Date.prototype.isBefore=function(d){return this.getTime()<d.getTime();};Date.prototype.getUTCTime=function(){return Date.UTC(this.getFullYear(),this.getMonth(),this.getDate(),this.getHours(),this.getMinutes(),this.getSeconds(),this.getMilliseconds());};Date.prototype.getTimeSince=function(d){return this.getUTCTime()-d.getUTCTime();};Date.prototype.getPreviousSunday=function(){var midday=new Date(this.getFullYear(),this.getMonth(),this.getDate(),12,0,0);var previousSunday=new Date(midday.getTime()-this.getDay()*ONE_DAY);return newDateAtMidnight(previousSunday.getFullYear(),previousSunday.getMonth(),previousSunday.getDate());};Date.prototype.getWeekInYear=function(minimalDaysInFirstWeek){if(isUndefined(this.minimalDaysInFirstWeek)){minimalDaysInFirstWeek=DEFAULT_MINIMAL_DAYS_IN_FIRST_WEEK;}
var previousSunday=this.getPreviousSunday();var startOfYear=newDateAtMidnight(this.getFullYear(),0,1);var numberOfSundays=previousSunday.isBefore(startOfYear)?0:1+Math.floor(previousSunday.getTimeSince(startOfYear)/ONE_WEEK);var numberOfDaysInFirstWeek=7-startOfYear.getDay();var weekInYear=numberOfSundays;if(numberOfDaysInFirstWeek<minimalDaysInFirstWeek){weekInYear--;}
return weekInYear;};Date.prototype.getWeekInMonth=function(minimalDaysInFirstWeek){if(isUndefined(this.minimalDaysInFirstWeek)){minimalDaysInFirstWeek=DEFAULT_MINIMAL_DAYS_IN_FIRST_WEEK;}
var previousSunday=this.getPreviousSunday();var startOfMonth=newDateAtMidnight(this.getFullYear(),this.getMonth(),1);var numberOfSundays=previousSunday.isBefore(startOfMonth)?0:1+Math.floor(previousSunday.getTimeSince(startOfMonth)/ONE_WEEK);var numberOfDaysInFirstWeek=7-startOfMonth.getDay();var weekInMonth=numberOfSundays;if(numberOfDaysInFirstWeek>=minimalDaysInFirstWeek){weekInMonth++;}
return weekInMonth;};Date.prototype.getDayInYear=function(){var startOfYear=newDateAtMidnight(this.getFullYear(),0,1);return 1+Math.floor(this.getTimeSince(startOfYear)/ONE_DAY);};SimpleDateFormat=function(formatString){this.formatString=formatString;};SimpleDateFormat.prototype.setMinimalDaysInFirstWeek=function(days){this.minimalDaysInFirstWeek=days;};SimpleDateFormat.prototype.getMinimalDaysInFirstWeek=function(){return isUndefined(this.minimalDaysInFirstWeek)?DEFAULT_MINIMAL_DAYS_IN_FIRST_WEEK:this.minimalDaysInFirstWeek;};var padWithZeroes=function(str,len){while(str.length<len){str="0"+str;}
return str;};var formatText=function(data,numberOfLetters,minLength){return(numberOfLetters>=4)?data:data.substr(0,Math.max(minLength,numberOfLetters));};var formatNumber=function(data,numberOfLetters){var dataString=""+data;return padWithZeroes(dataString,numberOfLetters);};SimpleDateFormat.prototype.format=function(date){var formattedString="";var result;var searchString=this.formatString;while((result=regex.exec(searchString))){var quotedString=result[1];var patternLetters=result[2];var otherLetters=result[3];var otherCharacters=result[4];if(quotedString){if(quotedString=="''"){formattedString+="'";}else{formattedString+=quotedString.substring(1,quotedString.length-1);}}else if(otherLetters){}else if(otherCharacters){formattedString+=otherCharacters;}else if(patternLetters){var patternLetter=patternLetters.charAt(0);var numberOfLetters=patternLetters.length;var rawData="";switch(patternLetter){case"G":rawData="AD";break;case"y":rawData=date.getFullYear();break;case"M":rawData=date.getMonth();break;case"w":rawData=date.getWeekInYear(this.getMinimalDaysInFirstWeek());break;case"W":rawData=date.getWeekInMonth(this.getMinimalDaysInFirstWeek());break;case"D":rawData=date.getDayInYear();break;case"d":rawData=date.getDate();break;case"F":rawData=1+Math.floor((date.getDate()-1)/7);break;case"E":rawData=dayNames[date.getDay()];break;case"a":rawData=(date.getHours()>=12)?"PM":"AM";break;case"H":rawData=date.getHours();break;case"k":rawData=date.getHours()||24;break;case"K":rawData=date.getHours()%12;break;case"h":rawData=(date.getHours()%12)||12;break;case"m":rawData=date.getMinutes();break;case"s":rawData=date.getSeconds();break;case"S":rawData=date.getMilliseconds();break;case"Z":rawData=date.getTimezoneOffset();break;}
switch(types[patternLetter]){case TEXT2:formattedString+=formatText(rawData,numberOfLetters,2);break;case TEXT3:formattedString+=formatText(rawData,numberOfLetters,3);break;case NUMBER:formattedString+=formatNumber(rawData,numberOfLetters);break;case YEAR:if(numberOfLetters<=3){var dataString=""+rawData;formattedString+=dataString.substr(2,2);}else{formattedString+=formatNumber(rawData,numberOfLetters);}
break;case MONTH:if(numberOfLetters>=3){formattedString+=formatText(monthNames[rawData],numberOfLetters,numberOfLetters);}else{formattedString+=formatNumber(rawData+1,numberOfLetters);}
break;case TIMEZONE:var isPositive=(rawData>0);var prefix=isPositive?"-":"+";var absData=Math.abs(rawData);var hours=""+Math.floor(absData/60);hours=padWithZeroes(hours,2);var minutes=""+(absData%60);minutes=padWithZeroes(minutes,2);formattedString+=prefix+hours+minutes;break;}}
searchString=searchString.substr(result.index+result[0].length);}
return formattedString;};})();log4javascript.SimpleDateFormat=SimpleDateFormat;function PatternLayout(pattern){if(pattern){this.pattern=pattern;}else{this.pattern=PatternLayout.DEFAULT_CONVERSION_PATTERN;}
this.customFields=[];}
PatternLayout.TTCC_CONVERSION_PATTERN="%r %p %c - %m%n";PatternLayout.DEFAULT_CONVERSION_PATTERN="%m%n";PatternLayout.ISO8601_DATEFORMAT="yyyy-MM-dd HH:mm:ss,SSS";PatternLayout.DATETIME_DATEFORMAT="dd MMM yyyy HH:mm:ss,SSS";PatternLayout.ABSOLUTETIME_DATEFORMAT="HH:mm:ss,SSS";PatternLayout.prototype=new Layout();PatternLayout.prototype.format=function(loggingEvent){var regex=/%(-?[0-9]+)?(\.?[0-9]+)?([acdfmMnpr%])(\{([^\}]+)\})?|([^%]+)/;var formattedString="";var result;var searchString=this.pattern;while((result=regex.exec(searchString))){var matchedString=result[0];var padding=result[1];var truncation=result[2];var conversionCharacter=result[3];var specifier=result[5];var text=result[6];if(text){formattedString+=""+text;}else{var replacement="";switch(conversionCharacter){case"a":case"m":var depth=0;if(specifier){depth=parseInt(specifier,10);if(isNaN(depth)){handleError("PatternLayout.format: invalid specifier '"+
specifier+"' for conversion character '"+conversionCharacter+"' - should be a number");depth=0;}}
var messages=(conversionCharacter==="a")?loggingEvent.messages[0]:loggingEvent.messages;for(var i=0,len=messages.length;i<len;i++){if(i>0&&(replacement.charAt(replacement.length-1)!==" ")){replacement+=" ";}
if(depth===0){replacement+=messages[i];}else{replacement+=formatObjectExpansion(messages[i],depth);}}
break;case"c":var loggerName=loggingEvent.logger.name;if(specifier){var precision=parseInt(specifier,10);var loggerNameBits=loggingEvent.logger.name.split(".");if(precision>=loggerNameBits.length){replacement=loggerName;}else{replacement=loggerNameBits.slice(loggerNameBits.length-precision).join(".");}}else{replacement=loggerName;}
break;case"d":var dateFormat=PatternLayout.ISO8601_DATEFORMAT;if(specifier){dateFormat=specifier;if(dateFormat=="ISO8601"){dateFormat=PatternLayout.ISO8601_DATEFORMAT;}else if(dateFormat=="ABSOLUTE"){dateFormat=PatternLayout.ABSOLUTETIME_DATEFORMAT;}else if(dateFormat=="DATE"){dateFormat=PatternLayout.DATETIME_DATEFORMAT;}}
replacement=(new SimpleDateFormat(dateFormat)).format(loggingEvent.timeStamp);break;case"f":if(this.hasCustomFields()){var fieldIndex=0;if(specifier){fieldIndex=parseInt(specifier,10);if(isNaN(fieldIndex)){handleError("PatternLayout.format: invalid specifier '"+
specifier+"' for conversion character 'f' - should be a number");}else if(fieldIndex===0){handleError("PatternLayout.format: invalid specifier '"+
specifier+"' for conversion character 'f' - must be greater than zero");}else if(fieldIndex>this.customFields.length){handleError("PatternLayout.format: invalid specifier '"+
specifier+"' for conversion character 'f' - there aren't that many custom fields");}else{fieldIndex=fieldIndex-1;}}
var val=this.customFields[fieldIndex].value;if(typeof val=="function"){val=val(this,loggingEvent);}
replacement=val;}
break;case"n":replacement=newLine;break;case"p":replacement=loggingEvent.level.name;break;case"r":replacement=""+loggingEvent.timeStamp.getDifference(applicationStartDate);break;case"%":replacement="%";break;default:replacement=matchedString;break;}
var l;if(truncation){l=parseInt(truncation.substr(1),10);var strLen=replacement.length;if(l<strLen){replacement=replacement.substring(strLen-l,strLen);}}
if(padding){if(padding.charAt(0)=="-"){l=parseInt(padding.substr(1),10);while(replacement.length<l){replacement+=" ";}}else{l=parseInt(padding,10);while(replacement.length<l){replacement=" "+replacement;}}}
formattedString+=replacement;}
searchString=searchString.substr(result.index+result[0].length);}
return formattedString;};PatternLayout.prototype.ignoresThrowable=function(){return true;};PatternLayout.prototype.toString=function(){return"PatternLayout";};log4javascript.PatternLayout=PatternLayout;function AlertAppender(){}
AlertAppender.prototype=new Appender();AlertAppender.prototype.layout=new SimpleLayout();AlertAppender.prototype.append=function(loggingEvent){alert(this.getLayout().formatWithException(loggingEvent));};AlertAppender.prototype.toString=function(){return"AlertAppender";};log4javascript.AlertAppender=AlertAppender;function BrowserConsoleAppender(){}
BrowserConsoleAppender.prototype=new log4javascript.Appender();BrowserConsoleAppender.prototype.layout=new NullLayout();BrowserConsoleAppender.prototype.threshold=Level.DEBUG;BrowserConsoleAppender.prototype.append=function(loggingEvent){var appender=this;var getFormattedMessage=function(concatenate){var formattedMessage=appender.getLayout().formatWithException(loggingEvent);return(typeof formattedMessage=="string")?(concatenate?formattedMessage:[formattedMessage]):(concatenate?formattedMessage.join(" "):formattedMessage);};var console=window.console;if(console&&console.log){var consoleMethodName;if(console.debug&&Level.DEBUG.isGreaterOrEqual(loggingEvent.level)){consoleMethodName="debug";}else if(console.info&&Level.INFO.equals(loggingEvent.level)){consoleMethodName="info";}else if(console.warn&&Level.WARN.equals(loggingEvent.level)){consoleMethodName="warn";}else if(console.error&&loggingEvent.level.isGreaterOrEqual(Level.ERROR)){consoleMethodName="error";}else{consoleMethodName="log";}
if(typeof console[consoleMethodName].apply=="function"){console[consoleMethodName].apply(console,getFormattedMessage(false));}else{console[consoleMethodName](getFormattedMessage(true));}}else if((typeof opera!="undefined")&&opera.postError){opera.postError(getFormattedMessage(true));}};BrowserConsoleAppender.prototype.group=function(name){if(window.console&&window.console.group){window.console.group(name);}};BrowserConsoleAppender.prototype.groupEnd=function(){if(window.console&&window.console.groupEnd){window.console.groupEnd();}};BrowserConsoleAppender.prototype.toString=function(){return"BrowserConsoleAppender";};log4javascript.BrowserConsoleAppender=BrowserConsoleAppender;var xhrFactory=function(){return new XMLHttpRequest();};var xmlHttpFactories=[xhrFactory,function(){return new ActiveXObject("Msxml2.XMLHTTP");},function(){return new ActiveXObject("Microsoft.XMLHTTP");}];var withCredentialsSupported=false;var getXmlHttp=function(errorHandler){var xmlHttp=null,factory;for(var i=0,len=xmlHttpFactories.length;i<len;i++){factory=xmlHttpFactories[i];try{xmlHttp=factory();withCredentialsSupported=(factory==xhrFactory&&("withCredentials"in xmlHttp));getXmlHttp=factory;return xmlHttp;}catch(e){}}
if(errorHandler){errorHandler();}else{handleError("getXmlHttp: unable to obtain XMLHttpRequest object");}};function isHttpRequestSuccessful(xmlHttp){return isUndefined(xmlHttp.status)||xmlHttp.status===0||(xmlHttp.status>=200&&xmlHttp.status<300)||xmlHttp.status==1223;}
function AjaxAppender(url,withCredentials){var appender=this;var isSupported=true;if(!url){handleError("AjaxAppender: URL must be specified in constructor");isSupported=false;}
var timed=this.defaults.timed;var waitForResponse=this.defaults.waitForResponse;var batchSize=this.defaults.batchSize;var timerInterval=this.defaults.timerInterval;var requestSuccessCallback=this.defaults.requestSuccessCallback;var failCallback=this.defaults.failCallback;var postVarName=this.defaults.postVarName;var sendAllOnUnload=this.defaults.sendAllOnUnload;var contentType=this.defaults.contentType;var sessionId=null;var queuedLoggingEvents=[];var queuedRequests=[];var headers=[];var sending=false;var initialized=false;function checkCanConfigure(configOptionName){if(initialized){handleError("AjaxAppender: configuration option '"+
configOptionName+"' may not be set after the appender has been initialized");return false;}
return true;}
this.getSessionId=function(){return sessionId;};this.setSessionId=function(sessionIdParam){sessionId=extractStringFromParam(sessionIdParam,null);this.layout.setCustomField("sessionid",sessionId);};this.setLayout=function(layoutParam){if(checkCanConfigure("layout")){this.layout=layoutParam;if(sessionId!==null){this.setSessionId(sessionId);}}};this.isTimed=function(){return timed;};this.setTimed=function(timedParam){if(checkCanConfigure("timed")){timed=bool(timedParam);}};this.getTimerInterval=function(){return timerInterval;};this.setTimerInterval=function(timerIntervalParam){if(checkCanConfigure("timerInterval")){timerInterval=extractIntFromParam(timerIntervalParam,timerInterval);}};this.isWaitForResponse=function(){return waitForResponse;};this.setWaitForResponse=function(waitForResponseParam){if(checkCanConfigure("waitForResponse")){waitForResponse=bool(waitForResponseParam);}};this.getBatchSize=function(){return batchSize;};this.setBatchSize=function(batchSizeParam){if(checkCanConfigure("batchSize")){batchSize=extractIntFromParam(batchSizeParam,batchSize);}};this.isSendAllOnUnload=function(){return sendAllOnUnload;};this.setSendAllOnUnload=function(sendAllOnUnloadParam){if(checkCanConfigure("sendAllOnUnload")){sendAllOnUnload=extractBooleanFromParam(sendAllOnUnloadParam,sendAllOnUnload);}};this.setRequestSuccessCallback=function(requestSuccessCallbackParam){requestSuccessCallback=extractFunctionFromParam(requestSuccessCallbackParam,requestSuccessCallback);};this.setFailCallback=function(failCallbackParam){failCallback=extractFunctionFromParam(failCallbackParam,failCallback);};this.getPostVarName=function(){return postVarName;};this.setPostVarName=function(postVarNameParam){if(checkCanConfigure("postVarName")){postVarName=extractStringFromParam(postVarNameParam,postVarName);}};this.getHeaders=function(){return headers;};this.addHeader=function(name,value){if(name.toLowerCase()=="content-type"){contentType=value;}else{headers.push({name:name,value:value});}};function sendAll(){if(isSupported&&enabled){sending=true;var currentRequestBatch;if(waitForResponse){if(queuedRequests.length>0){currentRequestBatch=queuedRequests.shift();sendRequest(preparePostData(currentRequestBatch),sendAll);}else{sending=false;if(timed){scheduleSending();}}}else{while((currentRequestBatch=queuedRequests.shift())){sendRequest(preparePostData(currentRequestBatch));}
sending=false;if(timed){scheduleSending();}}}}
this.sendAll=sendAll;function sendAllRemaining(){var sendingAnything=false;if(isSupported&&enabled){var actualBatchSize=appender.getLayout().allowBatching()?batchSize:1;var currentLoggingEvent;var batchedLoggingEvents=[];while((currentLoggingEvent=queuedLoggingEvents.shift())){batchedLoggingEvents.push(currentLoggingEvent);if(queuedLoggingEvents.length>=actualBatchSize){queuedRequests.push(batchedLoggingEvents);batchedLoggingEvents=[];}}
if(batchedLoggingEvents.length>0){queuedRequests.push(batchedLoggingEvents);}
sendingAnything=(queuedRequests.length>0);waitForResponse=false;timed=false;sendAll();}
return sendingAnything;}
this.sendAllRemaining=sendAllRemaining;function preparePostData(batchedLoggingEvents){var formattedMessages=[];var currentLoggingEvent;var postData="";while((currentLoggingEvent=batchedLoggingEvents.shift())){formattedMessages.push(appender.getLayout().formatWithException(currentLoggingEvent));}
if(batchedLoggingEvents.length==1){postData=formattedMessages.join("");}else{postData=appender.getLayout().batchHeader+
formattedMessages.join(appender.getLayout().batchSeparator)+
appender.getLayout().batchFooter;}
if(contentType==appender.defaults.contentType){postData=appender.getLayout().returnsPostData?postData:urlEncode(postVarName)+"="+urlEncode(postData);if(postData.length>0){postData+="&";}
postData+="layout="+urlEncode(appender.getLayout().toString());}
return postData;}
function scheduleSending(){window.setTimeout(sendAll,timerInterval);}
function xmlHttpErrorHandler(){var msg="AjaxAppender: could not create XMLHttpRequest object. AjaxAppender disabled";handleError(msg);isSupported=false;if(failCallback){failCallback(msg);}}
function sendRequest(postData,successCallback){try{var xmlHttp=getXmlHttp(xmlHttpErrorHandler);if(isSupported){xmlHttp.onreadystatechange=function(){if(xmlHttp.readyState==4){if(isHttpRequestSuccessful(xmlHttp)){if(requestSuccessCallback){requestSuccessCallback(xmlHttp);}
if(successCallback){successCallback(xmlHttp);}}else{var msg="AjaxAppender.append: XMLHttpRequest request to URL "+
url+" returned status code "+xmlHttp.status;handleError(msg);if(failCallback){failCallback(msg);}}
xmlHttp.onreadystatechange=emptyFunction;xmlHttp=null;}};xmlHttp.open("POST",url,true);if(withCredentials&&withCredentialsSupported){xmlHttp.withCredentials=true;}
try{for(var i=0,header;header=headers[i++];){xmlHttp.setRequestHeader(header.name,header.value);}
xmlHttp.setRequestHeader("Content-Type",contentType);}catch(headerEx){var msg="AjaxAppender.append: your browser's XMLHttpRequest implementation"+" does not support setRequestHeader, therefore cannot post data. AjaxAppender disabled";handleError(msg);isSupported=false;if(failCallback){failCallback(msg);}
return;}
xmlHttp.send(postData);}}catch(ex){var errMsg="AjaxAppender.append: error sending log message to "+url;handleError(errMsg,ex);isSupported=false;if(failCallback){failCallback(errMsg+". Details: "+getExceptionStringRep(ex));}}}
this.append=function(loggingEvent){if(isSupported){if(!initialized){init();}
queuedLoggingEvents.push(loggingEvent);var actualBatchSize=this.getLayout().allowBatching()?batchSize:1;if(queuedLoggingEvents.length>=actualBatchSize){var currentLoggingEvent;var batchedLoggingEvents=[];while((currentLoggingEvent=queuedLoggingEvents.shift())){batchedLoggingEvents.push(currentLoggingEvent);}
queuedRequests.push(batchedLoggingEvents);if(!timed&&(!waitForResponse||(waitForResponse&&!sending))){sendAll();}}}};function init(){initialized=true;if(sendAllOnUnload){var oldBeforeUnload=window.onbeforeunload;window.onbeforeunload=function(){if(oldBeforeUnload){oldBeforeUnload();}
sendAllRemaining();};}
if(timed){scheduleSending();}}}
AjaxAppender.prototype=new Appender();AjaxAppender.prototype.defaults={waitForResponse:false,timed:false,timerInterval:1000,batchSize:1,sendAllOnUnload:false,requestSuccessCallback:null,failCallback:null,postVarName:"data",contentType:"application/x-www-form-urlencoded"};AjaxAppender.prototype.layout=new HttpPostDataLayout();AjaxAppender.prototype.toString=function(){return"AjaxAppender";};log4javascript.AjaxAppender=AjaxAppender;function setCookie(name,value,days,path){var expires;path=path?"; path="+path:"";if(days){var date=new Date();date.setTime(date.getTime()+(days*24*60*60*1000));expires="; expires="+date.toGMTString();}else{expires="";}
document.cookie=escape(name)+"="+escape(value)+expires+path;}
function getCookie(name){var nameEquals=escape(name)+"=";var ca=document.cookie.split(";");for(var i=0,len=ca.length;i<len;i++){var c=ca[i];while(c.charAt(0)===" "){c=c.substring(1,c.length);}
if(c.indexOf(nameEquals)===0){return unescape(c.substring(nameEquals.length,c.length));}}
return null;}
function getBaseUrl(){var scripts=document.getElementsByTagName("script");for(var i=0,len=scripts.length;i<len;++i){if(scripts[i].src.indexOf("log4javascript")!=-1){var lastSlash=scripts[i].src.lastIndexOf("/");return(lastSlash==-1)?"":scripts[i].src.substr(0,lastSlash+1);}}
return null;}
function isLoaded(win){try{return bool(win.loaded);}catch(ex){return false;}}
var ConsoleAppender;(function(){var getConsoleHtmlLines=function(){return['<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">','<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">','<head>','<title>log4javascript</title>','<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />','<!-- Make IE8 behave like IE7, having gone to all the trouble of making IE work -->','<meta http-equiv="X-UA-Compatible" content="IE=7" />','<script type="text/javascript">var isIe = false, isIePre7 = false;</script>','<!--[if IE]><script type="text/javascript">isIe = true</script><![endif]-->','<!--[if lt IE 7]><script type="text/javascript">isIePre7 = true</script><![endif]-->','<script type="text/javascript">','//<![CDATA[','var loggingEnabled=true;var logQueuedEventsTimer=null;var logEntries=[];var logEntriesAndSeparators=[];var logItems=[];var renderDelay=100;var unrenderedLogItemsExist=false;var rootGroup,currentGroup=null;var loaded=false;var currentLogItem=null;var logMainContainer;function copyProperties(obj,props){for(var i in props){obj[i]=props[i];}}','function LogItem(){}','LogItem.prototype={mainContainer:null,wrappedContainer:null,unwrappedContainer:null,group:null,appendToLog:function(){for(var i=0,len=this.elementContainers.length;i<len;i++){this.elementContainers[i].appendToLog();}','this.group.update();},doRemove:function(doUpdate,removeFromGroup){if(this.rendered){for(var i=0,len=this.elementContainers.length;i<len;i++){this.elementContainers[i].remove();}','this.unwrappedElementContainer=null;this.wrappedElementContainer=null;this.mainElementContainer=null;}','if(this.group&&removeFromGroup){this.group.removeChild(this,doUpdate);}','if(this===currentLogItem){currentLogItem=null;}},remove:function(doUpdate,removeFromGroup){this.doRemove(doUpdate,removeFromGroup);},render:function(){},accept:function(visitor){visitor.visit(this);},getUnwrappedDomContainer:function(){return this.group.unwrappedElementContainer.contentDiv;},getWrappedDomContainer:function(){return this.group.wrappedElementContainer.contentDiv;},getMainDomContainer:function(){return this.group.mainElementContainer.contentDiv;}};LogItem.serializedItemKeys={LOG_ENTRY:0,GROUP_START:1,GROUP_END:2};function LogItemContainerElement(){}','LogItemContainerElement.prototype={appendToLog:function(){var insertBeforeFirst=(newestAtTop&&this.containerDomNode.hasChildNodes());if(insertBeforeFirst){this.containerDomNode.insertBefore(this.mainDiv,this.containerDomNode.firstChild);}else{this.containerDomNode.appendChild(this.mainDiv);}}};function SeparatorElementContainer(containerDomNode){this.containerDomNode=containerDomNode;this.mainDiv=document.createElement("div");this.mainDiv.className="separator";this.mainDiv.innerHTML="&nbsp;";}','SeparatorElementContainer.prototype=new LogItemContainerElement();SeparatorElementContainer.prototype.remove=function(){this.mainDiv.parentNode.removeChild(this.mainDiv);this.mainDiv=null;};function Separator(){this.rendered=false;}','Separator.prototype=new LogItem();copyProperties(Separator.prototype,{render:function(){var containerDomNode=this.group.contentDiv;if(isIe){this.unwrappedElementContainer=new SeparatorElementContainer(this.getUnwrappedDomContainer());this.wrappedElementContainer=new SeparatorElementContainer(this.getWrappedDomContainer());this.elementContainers=[this.unwrappedElementContainer,this.wrappedElementContainer];}else{this.mainElementContainer=new SeparatorElementContainer(this.getMainDomContainer());this.elementContainers=[this.mainElementContainer];}','this.content=this.formattedMessage;this.rendered=true;}});function GroupElementContainer(group,containerDomNode,isRoot,isWrapped){this.group=group;this.containerDomNode=containerDomNode;this.isRoot=isRoot;this.isWrapped=isWrapped;this.expandable=false;if(this.isRoot){if(isIe){this.contentDiv=logMainContainer.appendChild(document.createElement("div"));this.contentDiv.id=this.isWrapped?"log_wrapped":"log_unwrapped";}else{this.contentDiv=logMainContainer;}}else{var groupElementContainer=this;this.mainDiv=document.createElement("div");this.mainDiv.className="group";this.headingDiv=this.mainDiv.appendChild(document.createElement("div"));this.headingDiv.className="groupheading";this.expander=this.headingDiv.appendChild(document.createElement("span"));this.expander.className="expander unselectable greyedout";this.expander.unselectable=true;var expanderText=this.group.expanded?"-":"+";this.expanderTextNode=this.expander.appendChild(document.createTextNode(expanderText));this.headingDiv.appendChild(document.createTextNode(" "+this.group.name));this.contentDiv=this.mainDiv.appendChild(document.createElement("div"));var contentCssClass=this.group.expanded?"expanded":"collapsed";this.contentDiv.className="groupcontent "+contentCssClass;this.expander.onclick=function(){if(groupElementContainer.group.expandable){groupElementContainer.group.toggleExpanded();}};}}','GroupElementContainer.prototype=new LogItemContainerElement();copyProperties(GroupElementContainer.prototype,{toggleExpanded:function(){if(!this.isRoot){var oldCssClass,newCssClass,expanderText;if(this.group.expanded){newCssClass="expanded";oldCssClass="collapsed";expanderText="-";}else{newCssClass="collapsed";oldCssClass="expanded";expanderText="+";}','replaceClass(this.contentDiv,newCssClass,oldCssClass);this.expanderTextNode.nodeValue=expanderText;}},remove:function(){if(!this.isRoot){this.headingDiv=null;this.expander.onclick=null;this.expander=null;this.expanderTextNode=null;this.contentDiv=null;this.containerDomNode=null;this.mainDiv.parentNode.removeChild(this.mainDiv);this.mainDiv=null;}},reverseChildren:function(){var node=null;var childDomNodes=[];while((node=this.contentDiv.firstChild)){this.contentDiv.removeChild(node);childDomNodes.push(node);}','while((node=childDomNodes.pop())){this.contentDiv.appendChild(node);}},update:function(){if(!this.isRoot){if(this.group.expandable){removeClass(this.expander,"greyedout");}else{addClass(this.expander,"greyedout");}}},clear:function(){if(this.isRoot){this.contentDiv.innerHTML="";}}});function Group(name,isRoot,initiallyExpanded){this.name=name;this.group=null;this.isRoot=isRoot;this.initiallyExpanded=initiallyExpanded;this.elementContainers=[];this.children=[];this.expanded=initiallyExpanded;this.rendered=false;this.expandable=false;}','Group.prototype=new LogItem();copyProperties(Group.prototype,{addChild:function(logItem){this.children.push(logItem);logItem.group=this;},render:function(){if(isIe){var unwrappedDomContainer,wrappedDomContainer;if(this.isRoot){unwrappedDomContainer=logMainContainer;wrappedDomContainer=logMainContainer;}else{unwrappedDomContainer=this.getUnwrappedDomContainer();wrappedDomContainer=this.getWrappedDomContainer();}','this.unwrappedElementContainer=new GroupElementContainer(this,unwrappedDomContainer,this.isRoot,false);this.wrappedElementContainer=new GroupElementContainer(this,wrappedDomContainer,this.isRoot,true);this.elementContainers=[this.unwrappedElementContainer,this.wrappedElementContainer];}else{var mainDomContainer=this.isRoot?logMainContainer:this.getMainDomContainer();this.mainElementContainer=new GroupElementContainer(this,mainDomContainer,this.isRoot,false);this.elementContainers=[this.mainElementContainer];}','this.rendered=true;},toggleExpanded:function(){this.expanded=!this.expanded;for(var i=0,len=this.elementContainers.length;i<len;i++){this.elementContainers[i].toggleExpanded();}},expand:function(){if(!this.expanded){this.toggleExpanded();}},accept:function(visitor){visitor.visitGroup(this);},reverseChildren:function(){if(this.rendered){for(var i=0,len=this.elementContainers.length;i<len;i++){this.elementContainers[i].reverseChildren();}}},update:function(){var previouslyExpandable=this.expandable;this.expandable=(this.children.length!==0);if(this.expandable!==previouslyExpandable){for(var i=0,len=this.elementContainers.length;i<len;i++){this.elementContainers[i].update();}}},flatten:function(){var visitor=new GroupFlattener();this.accept(visitor);return visitor.logEntriesAndSeparators;},removeChild:function(child,doUpdate){array_remove(this.children,child);child.group=null;if(doUpdate){this.update();}},remove:function(doUpdate,removeFromGroup){for(var i=0,len=this.children.length;i<len;i++){this.children[i].remove(false,false);}','this.children=[];this.update();if(this===currentGroup){currentGroup=this.group;}','this.doRemove(doUpdate,removeFromGroup);},serialize:function(items){items.push([LogItem.serializedItemKeys.GROUP_START,this.name]);for(var i=0,len=this.children.length;i<len;i++){this.children[i].serialize(items);}','if(this!==currentGroup){items.push([LogItem.serializedItemKeys.GROUP_END]);}},clear:function(){for(var i=0,len=this.elementContainers.length;i<len;i++){this.elementContainers[i].clear();}}});function LogEntryElementContainer(){}','LogEntryElementContainer.prototype=new LogItemContainerElement();copyProperties(LogEntryElementContainer.prototype,{remove:function(){this.doRemove();},doRemove:function(){this.mainDiv.parentNode.removeChild(this.mainDiv);this.mainDiv=null;this.contentElement=null;this.containerDomNode=null;},setContent:function(content,wrappedContent){if(content===this.formattedMessage){this.contentElement.innerHTML="";this.contentElement.appendChild(document.createTextNode(this.formattedMessage));}else{this.contentElement.innerHTML=content;}},setSearchMatch:function(isMatch){var oldCssClass=isMatch?"searchnonmatch":"searchmatch";var newCssClass=isMatch?"searchmatch":"searchnonmatch";replaceClass(this.mainDiv,newCssClass,oldCssClass);},clearSearch:function(){removeClass(this.mainDiv,"searchmatch");removeClass(this.mainDiv,"searchnonmatch");}});function LogEntryWrappedElementContainer(logEntry,containerDomNode){this.logEntry=logEntry;this.containerDomNode=containerDomNode;this.mainDiv=document.createElement("div");this.mainDiv.appendChild(document.createTextNode(this.logEntry.formattedMessage));this.mainDiv.className="logentry wrapped "+this.logEntry.level;this.contentElement=this.mainDiv;}','LogEntryWrappedElementContainer.prototype=new LogEntryElementContainer();LogEntryWrappedElementContainer.prototype.setContent=function(content,wrappedContent){if(content===this.formattedMessage){this.contentElement.innerHTML="";this.contentElement.appendChild(document.createTextNode(this.formattedMessage));}else{this.contentElement.innerHTML=wrappedContent;}};function LogEntryUnwrappedElementContainer(logEntry,containerDomNode){this.logEntry=logEntry;this.containerDomNode=containerDomNode;this.mainDiv=document.createElement("div");this.mainDiv.className="logentry unwrapped "+this.logEntry.level;this.pre=this.mainDiv.appendChild(document.createElement("pre"));this.pre.appendChild(document.createTextNode(this.logEntry.formattedMessage));this.pre.className="unwrapped";this.contentElement=this.pre;}','LogEntryUnwrappedElementContainer.prototype=new LogEntryElementContainer();LogEntryUnwrappedElementContainer.prototype.remove=function(){this.doRemove();this.pre=null;};function LogEntryMainElementContainer(logEntry,containerDomNode){this.logEntry=logEntry;this.containerDomNode=containerDomNode;this.mainDiv=document.createElement("div");this.mainDiv.className="logentry nonielogentry "+this.logEntry.level;this.contentElement=this.mainDiv.appendChild(document.createElement("span"));this.contentElement.appendChild(document.createTextNode(this.logEntry.formattedMessage));}','LogEntryMainElementContainer.prototype=new LogEntryElementContainer();function LogEntry(level,formattedMessage){this.level=level;this.formattedMessage=formattedMessage;this.rendered=false;}','LogEntry.prototype=new LogItem();copyProperties(LogEntry.prototype,{render:function(){var logEntry=this;var containerDomNode=this.group.contentDiv;if(isIe){this.formattedMessage=this.formattedMessage.replace(/\\r\\n/g,"\\r");this.unwrappedElementContainer=new LogEntryUnwrappedElementContainer(this,this.getUnwrappedDomContainer());this.wrappedElementContainer=new LogEntryWrappedElementContainer(this,this.getWrappedDomContainer());this.elementContainers=[this.unwrappedElementContainer,this.wrappedElementContainer];}else{this.mainElementContainer=new LogEntryMainElementContainer(this,this.getMainDomContainer());this.elementContainers=[this.mainElementContainer];}','this.content=this.formattedMessage;this.rendered=true;},setContent:function(content,wrappedContent){if(content!=this.content){if(isIe&&(content!==this.formattedMessage)){content=content.replace(/\\r\\n/g,"\\r");}','for(var i=0,len=this.elementContainers.length;i<len;i++){this.elementContainers[i].setContent(content,wrappedContent);}','this.content=content;}},getSearchMatches:function(){var matches=[];var i,len;if(isIe){var unwrappedEls=getElementsByClass(this.unwrappedElementContainer.mainDiv,"searchterm","span");var wrappedEls=getElementsByClass(this.wrappedElementContainer.mainDiv,"searchterm","span");for(i=0,len=unwrappedEls.length;i<len;i++){matches[i]=new Match(this.level,null,unwrappedEls[i],wrappedEls[i]);}}else{var els=getElementsByClass(this.mainElementContainer.mainDiv,"searchterm","span");for(i=0,len=els.length;i<len;i++){matches[i]=new Match(this.level,els[i]);}}','return matches;},setSearchMatch:function(isMatch){for(var i=0,len=this.elementContainers.length;i<len;i++){this.elementContainers[i].setSearchMatch(isMatch);}},clearSearch:function(){for(var i=0,len=this.elementContainers.length;i<len;i++){this.elementContainers[i].clearSearch();}},accept:function(visitor){visitor.visitLogEntry(this);},serialize:function(items){items.push([LogItem.serializedItemKeys.LOG_ENTRY,this.level,this.formattedMessage]);}});function LogItemVisitor(){}','LogItemVisitor.prototype={visit:function(logItem){},visitParent:function(logItem){if(logItem.group){logItem.group.accept(this);}},visitChildren:function(logItem){for(var i=0,len=logItem.children.length;i<len;i++){logItem.children[i].accept(this);}},visitLogEntry:function(logEntry){this.visit(logEntry);},visitSeparator:function(separator){this.visit(separator);},visitGroup:function(group){this.visit(group);}};function GroupFlattener(){this.logEntriesAndSeparators=[];}','GroupFlattener.prototype=new LogItemVisitor();GroupFlattener.prototype.visitGroup=function(group){this.visitChildren(group);};GroupFlattener.prototype.visitLogEntry=function(logEntry){this.logEntriesAndSeparators.push(logEntry);};GroupFlattener.prototype.visitSeparator=function(separator){this.logEntriesAndSeparators.push(separator);};window.onload=function(){if(location.search){var queryBits=unescape(location.search).substr(1).split("&"),nameValueBits;for(var i=0,len=queryBits.length;i<len;i++){nameValueBits=queryBits[i].split("=");if(nameValueBits[0]=="log4javascript_domain"){document.domain=nameValueBits[1];break;}}}','logMainContainer=$("log");if(isIePre7){addClass(logMainContainer,"oldIe");}','rootGroup=new Group("root",true);rootGroup.render();currentGroup=rootGroup;setCommandInputWidth();setLogContainerHeight();toggleLoggingEnabled();toggleSearchEnabled();toggleSearchFilter();toggleSearchHighlight();applyFilters();checkAllLevels();toggleWrap();toggleNewestAtTop();toggleScrollToLatest();renderQueuedLogItems();loaded=true;$("command").value="";$("command").autocomplete="off";$("command").onkeydown=function(evt){evt=getEvent(evt);if(evt.keyCode==10||evt.keyCode==13){evalCommandLine();stopPropagation(evt);}else if(evt.keyCode==27){this.value="";this.focus();}else if(evt.keyCode==38&&commandHistory.length>0){currentCommandIndex=Math.max(0,currentCommandIndex-1);this.value=commandHistory[currentCommandIndex];moveCaretToEnd(this);}else if(evt.keyCode==40&&commandHistory.length>0){currentCommandIndex=Math.min(commandHistory.length-1,currentCommandIndex+1);this.value=commandHistory[currentCommandIndex];moveCaretToEnd(this);}};$("command").onkeypress=function(evt){evt=getEvent(evt);if(evt.keyCode==38&&commandHistory.length>0&&evt.preventDefault){evt.preventDefault();}};$("command").onkeyup=function(evt){evt=getEvent(evt);if(evt.keyCode==27&&evt.preventDefault){evt.preventDefault();this.focus();}};document.onkeydown=function keyEventHandler(evt){evt=getEvent(evt);switch(evt.keyCode){case 69:if(evt.shiftKey&&(evt.ctrlKey||evt.metaKey)){evalLastCommand();cancelKeyEvent(evt);return false;}','break;case 75:if(evt.shiftKey&&(evt.ctrlKey||evt.metaKey)){focusSearch();cancelKeyEvent(evt);return false;}','break;case 40:case 76:if(evt.shiftKey&&(evt.ctrlKey||evt.metaKey)){focusCommandLine();cancelKeyEvent(evt);return false;}','break;}};setTimeout(setLogContainerHeight,20);setShowCommandLine(showCommandLine);doSearch();};window.onunload=function(){if(mainWindowExists()){appender.unload();}','appender=null;};function toggleLoggingEnabled(){setLoggingEnabled($("enableLogging").checked);}','function setLoggingEnabled(enable){loggingEnabled=enable;}','var appender=null;function setAppender(appenderParam){appender=appenderParam;}','function setShowCloseButton(showCloseButton){$("closeButton").style.display=showCloseButton?"inline":"none";}','function setShowHideButton(showHideButton){$("hideButton").style.display=showHideButton?"inline":"none";}','var newestAtTop=false;function LogItemContentReverser(){}','LogItemContentReverser.prototype=new LogItemVisitor();LogItemContentReverser.prototype.visitGroup=function(group){group.reverseChildren();this.visitChildren(group);};function setNewestAtTop(isNewestAtTop){var oldNewestAtTop=newestAtTop;var i,iLen,j,jLen;newestAtTop=Boolean(isNewestAtTop);if(oldNewestAtTop!=newestAtTop){var visitor=new LogItemContentReverser();rootGroup.accept(visitor);if(currentSearch){var currentMatch=currentSearch.matches[currentMatchIndex];var matchIndex=0;var matches=[];var actOnLogEntry=function(logEntry){var logEntryMatches=logEntry.getSearchMatches();for(j=0,jLen=logEntryMatches.length;j<jLen;j++){matches[matchIndex]=logEntryMatches[j];if(currentMatch&&logEntryMatches[j].equals(currentMatch)){currentMatchIndex=matchIndex;}','matchIndex++;}};if(newestAtTop){for(i=logEntries.length-1;i>=0;i--){actOnLogEntry(logEntries[i]);}}else{for(i=0,iLen=logEntries.length;i<iLen;i++){actOnLogEntry(logEntries[i]);}}','currentSearch.matches=matches;if(currentMatch){currentMatch.setCurrent();}}else if(scrollToLatest){doScrollToLatest();}}','$("newestAtTop").checked=isNewestAtTop;}','function toggleNewestAtTop(){var isNewestAtTop=$("newestAtTop").checked;setNewestAtTop(isNewestAtTop);}','var scrollToLatest=true;function setScrollToLatest(isScrollToLatest){scrollToLatest=isScrollToLatest;if(scrollToLatest){doScrollToLatest();}','$("scrollToLatest").checked=isScrollToLatest;}','function toggleScrollToLatest(){var isScrollToLatest=$("scrollToLatest").checked;setScrollToLatest(isScrollToLatest);}','function doScrollToLatest(){var l=logMainContainer;if(typeof l.scrollTop!="undefined"){if(newestAtTop){l.scrollTop=0;}else{var latestLogEntry=l.lastChild;if(latestLogEntry){l.scrollTop=l.scrollHeight;}}}}','var closeIfOpenerCloses=true;function setCloseIfOpenerCloses(isCloseIfOpenerCloses){closeIfOpenerCloses=isCloseIfOpenerCloses;}','var maxMessages=null;function setMaxMessages(max){maxMessages=max;pruneLogEntries();}','var showCommandLine=false;function setShowCommandLine(isShowCommandLine){showCommandLine=isShowCommandLine;if(loaded){$("commandLine").style.display=showCommandLine?"block":"none";setCommandInputWidth();setLogContainerHeight();}}','function focusCommandLine(){if(loaded){$("command").focus();}}','function focusSearch(){if(loaded){$("searchBox").focus();}}','function getLogItems(){var items=[];for(var i=0,len=logItems.length;i<len;i++){logItems[i].serialize(items);}','return items;}','function setLogItems(items){var loggingReallyEnabled=loggingEnabled;loggingEnabled=true;for(var i=0,len=items.length;i<len;i++){switch(items[i][0]){case LogItem.serializedItemKeys.LOG_ENTRY:log(items[i][1],items[i][2]);break;case LogItem.serializedItemKeys.GROUP_START:group(items[i][1]);break;case LogItem.serializedItemKeys.GROUP_END:groupEnd();break;}}','loggingEnabled=loggingReallyEnabled;}','function log(logLevel,formattedMessage){if(loggingEnabled){var logEntry=new LogEntry(logLevel,formattedMessage);logEntries.push(logEntry);logEntriesAndSeparators.push(logEntry);logItems.push(logEntry);currentGroup.addChild(logEntry);if(loaded){if(logQueuedEventsTimer!==null){clearTimeout(logQueuedEventsTimer);}','logQueuedEventsTimer=setTimeout(renderQueuedLogItems,renderDelay);unrenderedLogItemsExist=true;}}}','function renderQueuedLogItems(){logQueuedEventsTimer=null;var pruned=pruneLogEntries();var initiallyHasMatches=currentSearch?currentSearch.hasMatches():false;for(var i=0,len=logItems.length;i<len;i++){if(!logItems[i].rendered){logItems[i].render();logItems[i].appendToLog();if(currentSearch&&(logItems[i]instanceof LogEntry)){currentSearch.applyTo(logItems[i]);}}}','if(currentSearch){if(pruned){if(currentSearch.hasVisibleMatches()){if(currentMatchIndex===null){setCurrentMatchIndex(0);}','displayMatches();}else{displayNoMatches();}}else if(!initiallyHasMatches&&currentSearch.hasVisibleMatches()){setCurrentMatchIndex(0);displayMatches();}}','if(scrollToLatest){doScrollToLatest();}','unrenderedLogItemsExist=false;}','function pruneLogEntries(){if((maxMessages!==null)&&(logEntriesAndSeparators.length>maxMessages)){var numberToDelete=logEntriesAndSeparators.length-maxMessages;var prunedLogEntries=logEntriesAndSeparators.slice(0,numberToDelete);if(currentSearch){currentSearch.removeMatches(prunedLogEntries);}','var group;for(var i=0;i<numberToDelete;i++){group=logEntriesAndSeparators[i].group;array_remove(logItems,logEntriesAndSeparators[i]);array_remove(logEntries,logEntriesAndSeparators[i]);logEntriesAndSeparators[i].remove(true,true);if(group.children.length===0&&group!==currentGroup&&group!==rootGroup){array_remove(logItems,group);group.remove(true,true);}}','logEntriesAndSeparators=array_removeFromStart(logEntriesAndSeparators,numberToDelete);return true;}','return false;}','function group(name,startExpanded){if(loggingEnabled){initiallyExpanded=(typeof startExpanded==="undefined")?true:Boolean(startExpanded);var newGroup=new Group(name,false,initiallyExpanded);currentGroup.addChild(newGroup);currentGroup=newGroup;logItems.push(newGroup);if(loaded){if(logQueuedEventsTimer!==null){clearTimeout(logQueuedEventsTimer);}','logQueuedEventsTimer=setTimeout(renderQueuedLogItems,renderDelay);unrenderedLogItemsExist=true;}}}','function groupEnd(){currentGroup=(currentGroup===rootGroup)?rootGroup:currentGroup.group;}','function mainPageReloaded(){currentGroup=rootGroup;var separator=new Separator();logEntriesAndSeparators.push(separator);logItems.push(separator);currentGroup.addChild(separator);}','function closeWindow(){if(appender&&mainWindowExists()){appender.close(true);}else{window.close();}}','function hide(){if(appender&&mainWindowExists()){appender.hide();}}','var mainWindow=window;var windowId="log4javascriptConsoleWindow_"+new Date().getTime()+"_"+(""+Math.random()).substr(2);function setMainWindow(win){mainWindow=win;mainWindow[windowId]=window;if(opener&&closeIfOpenerCloses){pollOpener();}}','function pollOpener(){if(closeIfOpenerCloses){if(mainWindowExists()){setTimeout(pollOpener,500);}else{closeWindow();}}}','function mainWindowExists(){try{return(mainWindow&&!mainWindow.closed&&mainWindow[windowId]==window);}catch(ex){}','return false;}','var logLevels=["TRACE","DEBUG","INFO","WARN","ERROR","FATAL"];function getCheckBox(logLevel){return $("switch_"+logLevel);}','function getIeWrappedLogContainer(){return $("log_wrapped");}','function getIeUnwrappedLogContainer(){return $("log_unwrapped");}','function applyFilters(){for(var i=0;i<logLevels.length;i++){if(getCheckBox(logLevels[i]).checked){addClass(logMainContainer,logLevels[i]);}else{removeClass(logMainContainer,logLevels[i]);}}','updateSearchFromFilters();}','function toggleAllLevels(){var turnOn=$("switch_ALL").checked;for(var i=0;i<logLevels.length;i++){getCheckBox(logLevels[i]).checked=turnOn;if(turnOn){addClass(logMainContainer,logLevels[i]);}else{removeClass(logMainContainer,logLevels[i]);}}}','function checkAllLevels(){for(var i=0;i<logLevels.length;i++){if(!getCheckBox(logLevels[i]).checked){getCheckBox("ALL").checked=false;return;}}','getCheckBox("ALL").checked=true;}','function clearLog(){rootGroup.clear();currentGroup=rootGroup;logEntries=[];logItems=[];logEntriesAndSeparators=[];doSearch();}','function toggleWrap(){var enable=$("wrap").checked;if(enable){addClass(logMainContainer,"wrap");}else{removeClass(logMainContainer,"wrap");}','refreshCurrentMatch();}','var searchTimer=null;function scheduleSearch(){try{clearTimeout(searchTimer);}catch(ex){}','searchTimer=setTimeout(doSearch,500);}','function Search(searchTerm,isRegex,searchRegex,isCaseSensitive){this.searchTerm=searchTerm;this.isRegex=isRegex;this.searchRegex=searchRegex;this.isCaseSensitive=isCaseSensitive;this.matches=[];}','Search.prototype={hasMatches:function(){return this.matches.length>0;},hasVisibleMatches:function(){if(this.hasMatches()){for(var i=0;i<this.matches.length;i++){if(this.matches[i].isVisible()){return true;}}}','return false;},match:function(logEntry){var entryText=String(logEntry.formattedMessage);var matchesSearch=false;if(this.isRegex){matchesSearch=this.searchRegex.test(entryText);}else if(this.isCaseSensitive){matchesSearch=(entryText.indexOf(this.searchTerm)>-1);}else{matchesSearch=(entryText.toLowerCase().indexOf(this.searchTerm.toLowerCase())>-1);}','return matchesSearch;},getNextVisibleMatchIndex:function(){for(var i=currentMatchIndex+1;i<this.matches.length;i++){if(this.matches[i].isVisible()){return i;}}','for(i=0;i<=currentMatchIndex;i++){if(this.matches[i].isVisible()){return i;}}','return-1;},getPreviousVisibleMatchIndex:function(){for(var i=currentMatchIndex-1;i>=0;i--){if(this.matches[i].isVisible()){return i;}}','for(var i=this.matches.length-1;i>=currentMatchIndex;i--){if(this.matches[i].isVisible()){return i;}}','return-1;},applyTo:function(logEntry){var doesMatch=this.match(logEntry);if(doesMatch){logEntry.group.expand();logEntry.setSearchMatch(true);var logEntryContent;var wrappedLogEntryContent;var searchTermReplacementStartTag="<span class=\\\"searchterm\\\">";var searchTermReplacementEndTag="<"+"/span>";var preTagName=isIe?"pre":"span";var preStartTag="<"+preTagName+" class=\\\"pre\\\">";var preEndTag="<"+"/"+preTagName+">";var startIndex=0;var searchIndex,matchedText,textBeforeMatch;if(this.isRegex){var flags=this.isCaseSensitive?"g":"gi";var capturingRegex=new RegExp("("+this.searchRegex.source+")",flags);var rnd=(""+Math.random()).substr(2);var startToken="%%s"+rnd+"%%";var endToken="%%e"+rnd+"%%";logEntryContent=logEntry.formattedMessage.replace(capturingRegex,startToken+"$1"+endToken);logEntryContent=escapeHtml(logEntryContent);var result;var searchString=logEntryContent;logEntryContent="";wrappedLogEntryContent="";while((searchIndex=searchString.indexOf(startToken,startIndex))>-1){var endTokenIndex=searchString.indexOf(endToken,searchIndex);matchedText=searchString.substring(searchIndex+startToken.length,endTokenIndex);textBeforeMatch=searchString.substring(startIndex,searchIndex);logEntryContent+=preStartTag+textBeforeMatch+preEndTag;logEntryContent+=searchTermReplacementStartTag+preStartTag+matchedText+','preEndTag+searchTermReplacementEndTag;if(isIe){wrappedLogEntryContent+=textBeforeMatch+searchTermReplacementStartTag+','matchedText+searchTermReplacementEndTag;}','startIndex=endTokenIndex+endToken.length;}','logEntryContent+=preStartTag+searchString.substr(startIndex)+preEndTag;if(isIe){wrappedLogEntryContent+=searchString.substr(startIndex);}}else{logEntryContent="";wrappedLogEntryContent="";var searchTermReplacementLength=searchTermReplacementStartTag.length+','this.searchTerm.length+searchTermReplacementEndTag.length;var searchTermLength=this.searchTerm.length;var searchTermLowerCase=this.searchTerm.toLowerCase();var logTextLowerCase=logEntry.formattedMessage.toLowerCase();while((searchIndex=logTextLowerCase.indexOf(searchTermLowerCase,startIndex))>-1){matchedText=escapeHtml(logEntry.formattedMessage.substr(searchIndex,this.searchTerm.length));textBeforeMatch=escapeHtml(logEntry.formattedMessage.substring(startIndex,searchIndex));var searchTermReplacement=searchTermReplacementStartTag+','preStartTag+matchedText+preEndTag+searchTermReplacementEndTag;logEntryContent+=preStartTag+textBeforeMatch+preEndTag+searchTermReplacement;if(isIe){wrappedLogEntryContent+=textBeforeMatch+searchTermReplacementStartTag+','matchedText+searchTermReplacementEndTag;}','startIndex=searchIndex+searchTermLength;}','var textAfterLastMatch=escapeHtml(logEntry.formattedMessage.substr(startIndex));logEntryContent+=preStartTag+textAfterLastMatch+preEndTag;if(isIe){wrappedLogEntryContent+=textAfterLastMatch;}}','logEntry.setContent(logEntryContent,wrappedLogEntryContent);var logEntryMatches=logEntry.getSearchMatches();this.matches=this.matches.concat(logEntryMatches);}else{logEntry.setSearchMatch(false);logEntry.setContent(logEntry.formattedMessage,logEntry.formattedMessage);}','return doesMatch;},removeMatches:function(logEntries){var matchesToRemoveCount=0;var currentMatchRemoved=false;var matchesToRemove=[];var i,iLen,j,jLen;for(i=0,iLen=this.matches.length;i<iLen;i++){for(j=0,jLen=logEntries.length;j<jLen;j++){if(this.matches[i].belongsTo(logEntries[j])){matchesToRemove.push(this.matches[i]);if(i===currentMatchIndex){currentMatchRemoved=true;}}}}','var newMatch=currentMatchRemoved?null:this.matches[currentMatchIndex];if(currentMatchRemoved){for(i=currentMatchIndex,iLen=this.matches.length;i<iLen;i++){if(this.matches[i].isVisible()&&!array_contains(matchesToRemove,this.matches[i])){newMatch=this.matches[i];break;}}}','for(i=0,iLen=matchesToRemove.length;i<iLen;i++){array_remove(this.matches,matchesToRemove[i]);matchesToRemove[i].remove();}','if(this.hasVisibleMatches()){if(newMatch===null){setCurrentMatchIndex(0);}else{var newMatchIndex=0;for(i=0,iLen=this.matches.length;i<iLen;i++){if(newMatch===this.matches[i]){newMatchIndex=i;break;}}','setCurrentMatchIndex(newMatchIndex);}}else{currentMatchIndex=null;displayNoMatches();}}};function getPageOffsetTop(el,container){var currentEl=el;var y=0;while(currentEl&&currentEl!=container){y+=currentEl.offsetTop;currentEl=currentEl.offsetParent;}','return y;}','function scrollIntoView(el){var logContainer=logMainContainer;if(!$("wrap").checked){var logContainerLeft=logContainer.scrollLeft;var logContainerRight=logContainerLeft+logContainer.offsetWidth;var elLeft=el.offsetLeft;var elRight=elLeft+el.offsetWidth;if(elLeft<logContainerLeft||elRight>logContainerRight){logContainer.scrollLeft=elLeft-(logContainer.offsetWidth-el.offsetWidth)/2;}}','var logContainerTop=logContainer.scrollTop;var logContainerBottom=logContainerTop+logContainer.offsetHeight;var elTop=getPageOffsetTop(el)-getToolBarsHeight();var elBottom=elTop+el.offsetHeight;if(elTop<logContainerTop||elBottom>logContainerBottom){logContainer.scrollTop=elTop-(logContainer.offsetHeight-el.offsetHeight)/2;}}','function Match(logEntryLevel,spanInMainDiv,spanInUnwrappedPre,spanInWrappedDiv){this.logEntryLevel=logEntryLevel;this.spanInMainDiv=spanInMainDiv;if(isIe){this.spanInUnwrappedPre=spanInUnwrappedPre;this.spanInWrappedDiv=spanInWrappedDiv;}','this.mainSpan=isIe?spanInUnwrappedPre:spanInMainDiv;}','Match.prototype={equals:function(match){return this.mainSpan===match.mainSpan;},setCurrent:function(){if(isIe){addClass(this.spanInUnwrappedPre,"currentmatch");addClass(this.spanInWrappedDiv,"currentmatch");var elementToScroll=$("wrap").checked?this.spanInWrappedDiv:this.spanInUnwrappedPre;scrollIntoView(elementToScroll);}else{addClass(this.spanInMainDiv,"currentmatch");scrollIntoView(this.spanInMainDiv);}},belongsTo:function(logEntry){if(isIe){return isDescendant(this.spanInUnwrappedPre,logEntry.unwrappedPre);}else{return isDescendant(this.spanInMainDiv,logEntry.mainDiv);}},setNotCurrent:function(){if(isIe){removeClass(this.spanInUnwrappedPre,"currentmatch");removeClass(this.spanInWrappedDiv,"currentmatch");}else{removeClass(this.spanInMainDiv,"currentmatch");}},isOrphan:function(){return isOrphan(this.mainSpan);},isVisible:function(){return getCheckBox(this.logEntryLevel).checked;},remove:function(){if(isIe){this.spanInUnwrappedPre=null;this.spanInWrappedDiv=null;}else{this.spanInMainDiv=null;}}};var currentSearch=null;var currentMatchIndex=null;function doSearch(){var searchBox=$("searchBox");var searchTerm=searchBox.value;var isRegex=$("searchRegex").checked;var isCaseSensitive=$("searchCaseSensitive").checked;var i;if(searchTerm===""){$("searchReset").disabled=true;$("searchNav").style.display="none";removeClass(document.body,"searching");removeClass(searchBox,"hasmatches");removeClass(searchBox,"nomatches");for(i=0;i<logEntries.length;i++){logEntries[i].clearSearch();logEntries[i].setContent(logEntries[i].formattedMessage,logEntries[i].formattedMessage);}','currentSearch=null;setLogContainerHeight();}else{$("searchReset").disabled=false;$("searchNav").style.display="block";var searchRegex;var regexValid;if(isRegex){try{searchRegex=isCaseSensitive?new RegExp(searchTerm,"g"):new RegExp(searchTerm,"gi");regexValid=true;replaceClass(searchBox,"validregex","invalidregex");searchBox.title="Valid regex";}catch(ex){regexValid=false;replaceClass(searchBox,"invalidregex","validregex");searchBox.title="Invalid regex: "+(ex.message?ex.message:(ex.description?ex.description:"unknown error"));return;}}else{searchBox.title="";removeClass(searchBox,"validregex");removeClass(searchBox,"invalidregex");}','addClass(document.body,"searching");currentSearch=new Search(searchTerm,isRegex,searchRegex,isCaseSensitive);for(i=0;i<logEntries.length;i++){currentSearch.applyTo(logEntries[i]);}','setLogContainerHeight();if(currentSearch.hasVisibleMatches()){setCurrentMatchIndex(0);displayMatches();}else{displayNoMatches();}}}','function updateSearchFromFilters(){if(currentSearch){if(currentSearch.hasMatches()){if(currentMatchIndex===null){currentMatchIndex=0;}','var currentMatch=currentSearch.matches[currentMatchIndex];if(currentMatch.isVisible()){displayMatches();setCurrentMatchIndex(currentMatchIndex);}else{currentMatch.setNotCurrent();var nextVisibleMatchIndex=currentSearch.getNextVisibleMatchIndex();if(nextVisibleMatchIndex>-1){setCurrentMatchIndex(nextVisibleMatchIndex);displayMatches();}else{displayNoMatches();}}}else{displayNoMatches();}}}','function refreshCurrentMatch(){if(currentSearch&&currentSearch.hasVisibleMatches()){setCurrentMatchIndex(currentMatchIndex);}}','function displayMatches(){replaceClass($("searchBox"),"hasmatches","nomatches");$("searchBox").title=""+currentSearch.matches.length+" matches found";$("searchNav").style.display="block";setLogContainerHeight();}','function displayNoMatches(){replaceClass($("searchBox"),"nomatches","hasmatches");$("searchBox").title="No matches found";$("searchNav").style.display="none";setLogContainerHeight();}','function toggleSearchEnabled(enable){enable=(typeof enable=="undefined")?!$("searchDisable").checked:enable;$("searchBox").disabled=!enable;$("searchReset").disabled=!enable;$("searchRegex").disabled=!enable;$("searchNext").disabled=!enable;$("searchPrevious").disabled=!enable;$("searchCaseSensitive").disabled=!enable;$("searchNav").style.display=(enable&&($("searchBox").value!=="")&&currentSearch&&currentSearch.hasVisibleMatches())?"block":"none";if(enable){removeClass($("search"),"greyedout");addClass(document.body,"searching");if($("searchHighlight").checked){addClass(logMainContainer,"searchhighlight");}else{removeClass(logMainContainer,"searchhighlight");}','if($("searchFilter").checked){addClass(logMainContainer,"searchfilter");}else{removeClass(logMainContainer,"searchfilter");}','$("searchDisable").checked=!enable;}else{addClass($("search"),"greyedout");removeClass(document.body,"searching");removeClass(logMainContainer,"searchhighlight");removeClass(logMainContainer,"searchfilter");}','setLogContainerHeight();}','function toggleSearchFilter(){var enable=$("searchFilter").checked;if(enable){addClass(logMainContainer,"searchfilter");}else{removeClass(logMainContainer,"searchfilter");}','refreshCurrentMatch();}','function toggleSearchHighlight(){var enable=$("searchHighlight").checked;if(enable){addClass(logMainContainer,"searchhighlight");}else{removeClass(logMainContainer,"searchhighlight");}}','function clearSearch(){$("searchBox").value="";doSearch();}','function searchNext(){if(currentSearch!==null&&currentMatchIndex!==null){currentSearch.matches[currentMatchIndex].setNotCurrent();var nextMatchIndex=currentSearch.getNextVisibleMatchIndex();if(nextMatchIndex>currentMatchIndex||confirm("Reached the end of the page. Start from the top?")){setCurrentMatchIndex(nextMatchIndex);}}}','function searchPrevious(){if(currentSearch!==null&&currentMatchIndex!==null){currentSearch.matches[currentMatchIndex].setNotCurrent();var previousMatchIndex=currentSearch.getPreviousVisibleMatchIndex();if(previousMatchIndex<currentMatchIndex||confirm("Reached the start of the page. Continue from the bottom?")){setCurrentMatchIndex(previousMatchIndex);}}}','function setCurrentMatchIndex(index){currentMatchIndex=index;currentSearch.matches[currentMatchIndex].setCurrent();}','function addClass(el,cssClass){if(!hasClass(el,cssClass)){if(el.className){el.className+=" "+cssClass;}else{el.className=cssClass;}}}','function hasClass(el,cssClass){if(el.className){var classNames=el.className.split(" ");return array_contains(classNames,cssClass);}','return false;}','function removeClass(el,cssClass){if(hasClass(el,cssClass)){var existingClasses=el.className.split(" ");var newClasses=[];for(var i=0,len=existingClasses.length;i<len;i++){if(existingClasses[i]!=cssClass){newClasses[newClasses.length]=existingClasses[i];}}','el.className=newClasses.join(" ");}}','function replaceClass(el,newCssClass,oldCssClass){removeClass(el,oldCssClass);addClass(el,newCssClass);}','function getElementsByClass(el,cssClass,tagName){var elements=el.getElementsByTagName(tagName);var matches=[];for(var i=0,len=elements.length;i<len;i++){if(hasClass(elements[i],cssClass)){matches.push(elements[i]);}}','return matches;}','function $(id){return document.getElementById(id);}','function isDescendant(node,ancestorNode){while(node!=null){if(node===ancestorNode){return true;}','node=node.parentNode;}','return false;}','function isOrphan(node){var currentNode=node;while(currentNode){if(currentNode==document.body){return false;}','currentNode=currentNode.parentNode;}','return true;}','function escapeHtml(str){return str.replace(/&/g,"&amp;").replace(/[<]/g,"&lt;").replace(/>/g,"&gt;");}','function getWindowWidth(){if(window.innerWidth){return window.innerWidth;}else if(document.documentElement&&document.documentElement.clientWidth){return document.documentElement.clientWidth;}else if(document.body){return document.body.clientWidth;}','return 0;}','function getWindowHeight(){if(window.innerHeight){return window.innerHeight;}else if(document.documentElement&&document.documentElement.clientHeight){return document.documentElement.clientHeight;}else if(document.body){return document.body.clientHeight;}','return 0;}','function getToolBarsHeight(){return $("switches").offsetHeight;}','function getChromeHeight(){var height=getToolBarsHeight();if(showCommandLine){height+=$("commandLine").offsetHeight;}','return height;}','function setLogContainerHeight(){if(logMainContainer){var windowHeight=getWindowHeight();$("body").style.height=getWindowHeight()+"px";logMainContainer.style.height=""+','Math.max(0,windowHeight-getChromeHeight())+"px";}}','function setCommandInputWidth(){if(showCommandLine){$("command").style.width=""+Math.max(0,$("commandLineContainer").offsetWidth-','($("evaluateButton").offsetWidth+13))+"px";}}','window.onresize=function(){setCommandInputWidth();setLogContainerHeight();};if(!Array.prototype.push){Array.prototype.push=function(){for(var i=0,len=arguments.length;i<len;i++){this[this.length]=arguments[i];}','return this.length;};}','if(!Array.prototype.pop){Array.prototype.pop=function(){if(this.length>0){var val=this[this.length-1];this.length=this.length-1;return val;}};}','if(!Array.prototype.shift){Array.prototype.shift=function(){if(this.length>0){var firstItem=this[0];for(var i=0,len=this.length-1;i<len;i++){this[i]=this[i+1];}','this.length=this.length-1;return firstItem;}};}','if(!Array.prototype.splice){Array.prototype.splice=function(startIndex,deleteCount){var itemsAfterDeleted=this.slice(startIndex+deleteCount);var itemsDeleted=this.slice(startIndex,startIndex+deleteCount);this.length=startIndex;var argumentsArray=[];for(var i=0,len=arguments.length;i<len;i++){argumentsArray[i]=arguments[i];}','var itemsToAppend=(argumentsArray.length>2)?itemsAfterDeleted=argumentsArray.slice(2).concat(itemsAfterDeleted):itemsAfterDeleted;for(i=0,len=itemsToAppend.length;i<len;i++){this.push(itemsToAppend[i]);}','return itemsDeleted;};}','function array_remove(arr,val){var index=-1;for(var i=0,len=arr.length;i<len;i++){if(arr[i]===val){index=i;break;}}','if(index>=0){arr.splice(index,1);return index;}else{return false;}}','function array_removeFromStart(array,numberToRemove){if(Array.prototype.splice){array.splice(0,numberToRemove);}else{for(var i=numberToRemove,len=array.length;i<len;i++){array[i-numberToRemove]=array[i];}','array.length=array.length-numberToRemove;}','return array;}','function array_contains(arr,val){for(var i=0,len=arr.length;i<len;i++){if(arr[i]==val){return true;}}','return false;}','function getErrorMessage(ex){if(ex.message){return ex.message;}else if(ex.description){return ex.description;}','return""+ex;}','function moveCaretToEnd(input){if(input.setSelectionRange){input.focus();var length=input.value.length;input.setSelectionRange(length,length);}else if(input.createTextRange){var range=input.createTextRange();range.collapse(false);range.select();}','input.focus();}','function stopPropagation(evt){if(evt.stopPropagation){evt.stopPropagation();}else if(typeof evt.cancelBubble!="undefined"){evt.cancelBubble=true;}}','function getEvent(evt){return evt?evt:event;}','function getTarget(evt){return evt.target?evt.target:evt.srcElement;}','function getRelatedTarget(evt){if(evt.relatedTarget){return evt.relatedTarget;}else if(evt.srcElement){switch(evt.type){case"mouseover":return evt.fromElement;case"mouseout":return evt.toElement;default:return evt.srcElement;}}}','function cancelKeyEvent(evt){evt.returnValue=false;stopPropagation(evt);}','function evalCommandLine(){var expr=$("command").value;evalCommand(expr);$("command").value="";}','function evalLastCommand(){if(lastCommand!=null){evalCommand(lastCommand);}}','var lastCommand=null;var commandHistory=[];var currentCommandIndex=0;function evalCommand(expr){if(appender){appender.evalCommandAndAppend(expr);}else{var prefix=">>> "+expr+"\\r\\n";try{log("INFO",prefix+eval(expr));}catch(ex){log("ERROR",prefix+"Error: "+getErrorMessage(ex));}}','if(expr!=commandHistory[commandHistory.length-1]){commandHistory.push(expr);if(appender){appender.storeCommandHistory(commandHistory);}}','currentCommandIndex=(expr==commandHistory[currentCommandIndex])?currentCommandIndex+1:commandHistory.length;lastCommand=expr;}','//]]>','</script>','<style type="text/css">','body{background-color:white;color:black;padding:0;margin:0;font-family:tahoma,verdana,arial,helvetica,sans-serif;overflow:hidden}div#switchesContainer input{margin-bottom:0}div.toolbar{border-top:solid #ffffff 1px;border-bottom:solid #aca899 1px;background-color:#f1efe7;padding:3px 5px;font-size:68.75%}div.toolbar,div#search input{font-family:tahoma,verdana,arial,helvetica,sans-serif}div.toolbar input.button{padding:0 5px;font-size:100%}div.toolbar input.hidden{display:none}div#switches input#clearButton{margin-left:20px}div#levels label{font-weight:bold}div#levels label,div#options label{margin-right:5px}div#levels label#wrapLabel{font-weight:normal}div#search label{margin-right:10px}div#search label.searchboxlabel{margin-right:0}div#search input{font-size:100%}div#search input.validregex{color:green}div#search input.invalidregex{color:red}div#search input.nomatches{color:white;background-color:#ff6666}div#search input.nomatches{color:white;background-color:#ff6666}div#searchNav{display:none}div#commandLine{display:none}div#commandLine input#command{font-size:100%;font-family:Courier New,Courier}div#commandLine input#evaluateButton{}*.greyedout{color:gray !important;border-color:gray !important}*.greyedout *.alwaysenabled{color:black}*.unselectable{-khtml-user-select:none;-moz-user-select:none;user-select:none}div#log{font-family:Courier New,Courier;font-size:75%;width:100%;overflow:auto;clear:both;position:relative}div.group{border-color:#cccccc;border-style:solid;border-width:1px 0 1px 1px;overflow:visible}div.oldIe div.group,div.oldIe div.group *,div.oldIe *.logentry{height:1%}div.group div.groupheading span.expander{border:solid black 1px;font-family:Courier New,Courier;font-size:0.833em;background-color:#eeeeee;position:relative;top:-1px;color:black;padding:0 2px;cursor:pointer;cursor:hand;height:1%}div.group div.groupcontent{margin-left:10px;padding-bottom:2px;overflow:visible}div.group div.expanded{display:block}div.group div.collapsed{display:none}*.logentry{overflow:visible;display:none;white-space:pre}span.pre{white-space:pre}pre.unwrapped{display:inline !important}pre.unwrapped pre.pre,div.wrapped pre.pre{display:inline}div.wrapped pre.pre{white-space:normal}div.wrapped{display:none}body.searching *.logentry span.currentmatch{color:white !important;background-color:green !important}body.searching div.searchhighlight *.logentry span.searchterm{color:black;background-color:yellow}div.wrap *.logentry{white-space:normal !important;border-width:0 0 1px 0;border-color:#dddddd;border-style:dotted}div.wrap #log_wrapped,#log_unwrapped{display:block}div.wrap #log_unwrapped,#log_wrapped{display:none}div.wrap *.logentry span.pre{overflow:visible;white-space:normal}div.wrap *.logentry pre.unwrapped{display:none}div.wrap *.logentry span.wrapped{display:inline}div.searchfilter *.searchnonmatch{display:none !important}div#log *.TRACE,label#label_TRACE{color:#666666}div#log *.DEBUG,label#label_DEBUG{color:green}div#log *.INFO,label#label_INFO{color:#000099}div#log *.WARN,label#label_WARN{color:#999900}div#log *.ERROR,label#label_ERROR{color:red}div#log *.FATAL,label#label_FATAL{color:#660066}div.TRACE#log *.TRACE,div.DEBUG#log *.DEBUG,div.INFO#log *.INFO,div.WARN#log *.WARN,div.ERROR#log *.ERROR,div.FATAL#log *.FATAL{display:block}div#log div.separator{background-color:#cccccc;margin:5px 0;line-height:1px}','</style>','</head>','<body id="body">','<div id="switchesContainer">','<div id="switches">','<div id="levels" class="toolbar">','Filters:','<input type="checkbox" id="switch_TRACE" onclick="applyFilters(); checkAllLevels()" checked="checked" title="Show/hide trace messages" /><label for="switch_TRACE" id="label_TRACE">trace</label>','<input type="checkbox" id="switch_DEBUG" onclick="applyFilters(); checkAllLevels()" checked="checked" title="Show/hide debug messages" /><label for="switch_DEBUG" id="label_DEBUG">debug</label>','<input type="checkbox" id="switch_INFO" onclick="applyFilters(); checkAllLevels()" checked="checked" title="Show/hide info messages" /><label for="switch_INFO" id="label_INFO">info</label>','<input type="checkbox" id="switch_WARN" onclick="applyFilters(); checkAllLevels()" checked="checked" title="Show/hide warn messages" /><label for="switch_WARN" id="label_WARN">warn</label>','<input type="checkbox" id="switch_ERROR" onclick="applyFilters(); checkAllLevels()" checked="checked" title="Show/hide error messages" /><label for="switch_ERROR" id="label_ERROR">error</label>','<input type="checkbox" id="switch_FATAL" onclick="applyFilters(); checkAllLevels()" checked="checked" title="Show/hide fatal messages" /><label for="switch_FATAL" id="label_FATAL">fatal</label>','<input type="checkbox" id="switch_ALL" onclick="toggleAllLevels(); applyFilters()" checked="checked" title="Show/hide all messages" /><label for="switch_ALL" id="label_ALL">all</label>','</div>','<div id="search" class="toolbar">','<label for="searchBox" class="searchboxlabel">Search:</label> <input type="text" id="searchBox" onclick="toggleSearchEnabled(true)" onkeyup="scheduleSearch()" size="20" />','<input type="button" id="searchReset" disabled="disabled" value="Reset" onclick="clearSearch()" class="button" title="Reset the search" />','<input type="checkbox" id="searchRegex" onclick="doSearch()" title="If checked, search is treated as a regular expression" /><label for="searchRegex">Regex</label>','<input type="checkbox" id="searchCaseSensitive" onclick="doSearch()" title="If checked, search is case sensitive" /><label for="searchCaseSensitive">Match case</label>','<input type="checkbox" id="searchDisable" onclick="toggleSearchEnabled()" title="Enable/disable search" /><label for="searchDisable" class="alwaysenabled">Disable</label>','<div id="searchNav">','<input type="button" id="searchNext" disabled="disabled" value="Next" onclick="searchNext()" class="button" title="Go to the next matching log entry" />','<input type="button" id="searchPrevious" disabled="disabled" value="Previous" onclick="searchPrevious()" class="button" title="Go to the previous matching log entry" />','<input type="checkbox" id="searchFilter" onclick="toggleSearchFilter()" title="If checked, non-matching log entries are filtered out" /><label for="searchFilter">Filter</label>','<input type="checkbox" id="searchHighlight" onclick="toggleSearchHighlight()" title="Highlight matched search terms" /><label for="searchHighlight" class="alwaysenabled">Highlight all</label>','</div>','</div>','<div id="options" class="toolbar">','Options:','<input type="checkbox" id="enableLogging" onclick="toggleLoggingEnabled()" checked="checked" title="Enable/disable logging" /><label for="enableLogging" id="enableLoggingLabel">Log</label>','<input type="checkbox" id="wrap" onclick="toggleWrap()" title="Enable / disable word wrap" /><label for="wrap" id="wrapLabel">Wrap</label>','<input type="checkbox" id="newestAtTop" onclick="toggleNewestAtTop()" title="If checked, causes newest messages to appear at the top" /><label for="newestAtTop" id="newestAtTopLabel">Newest at the top</label>','<input type="checkbox" id="scrollToLatest" onclick="toggleScrollToLatest()" checked="checked" title="If checked, window automatically scrolls to a new message when it is added" /><label for="scrollToLatest" id="scrollToLatestLabel">Scroll to latest</label>','<input type="button" id="clearButton" value="Clear" onclick="clearLog()" class="button" title="Clear all log messages"  />','<input type="button" id="hideButton" value="Hide" onclick="hide()" class="hidden button" title="Hide the console" />','<input type="button" id="closeButton" value="Close" onclick="closeWindow()" class="hidden button" title="Close the window" />','</div>','</div>','</div>','<div id="log" class="TRACE DEBUG INFO WARN ERROR FATAL"></div>','<div id="commandLine" class="toolbar">','<div id="commandLineContainer">','<input type="text" id="command" title="Enter a JavaScript command here and hit return or press \'Evaluate\'" />','<input type="button" id="evaluateButton" value="Evaluate" class="button" title="Evaluate the command" onclick="evalCommandLine()" />','</div>','</div>','</body>','</html>',''];};var defaultCommandLineFunctions=[];ConsoleAppender=function(){};var consoleAppenderIdCounter=1;ConsoleAppender.prototype=new Appender();ConsoleAppender.prototype.create=function(inPage,container,lazyInit,initiallyMinimized,useDocumentWrite,width,height,focusConsoleWindow){var appender=this;var initialized=false;var consoleWindowCreated=false;var consoleWindowLoaded=false;var consoleClosed=false;var queuedLoggingEvents=[];var isSupported=true;var consoleAppenderId=consoleAppenderIdCounter++;initiallyMinimized=extractBooleanFromParam(initiallyMinimized,this.defaults.initiallyMinimized);lazyInit=extractBooleanFromParam(lazyInit,this.defaults.lazyInit);useDocumentWrite=extractBooleanFromParam(useDocumentWrite,this.defaults.useDocumentWrite);var newestMessageAtTop=this.defaults.newestMessageAtTop;var scrollToLatestMessage=this.defaults.scrollToLatestMessage;width=width?width:this.defaults.width;height=height?height:this.defaults.height;var maxMessages=this.defaults.maxMessages;var showCommandLine=this.defaults.showCommandLine;var commandLineObjectExpansionDepth=this.defaults.commandLineObjectExpansionDepth;var showHideButton=this.defaults.showHideButton;var showCloseButton=this.defaults.showCloseButton;this.setLayout(this.defaults.layout);var init,createWindow,safeToAppend,getConsoleWindow,open;var appenderName=inPage?"InPageAppender":"PopUpAppender";var checkCanConfigure=function(configOptionName){if(consoleWindowCreated){handleError(appenderName+": configuration option '"+configOptionName+"' may not be set after the appender has been initialized");return false;}
return true;};var consoleWindowExists=function(){return(consoleWindowLoaded&&isSupported&&!consoleClosed);};this.isNewestMessageAtTop=function(){return newestMessageAtTop;};this.setNewestMessageAtTop=function(newestMessageAtTopParam){newestMessageAtTop=bool(newestMessageAtTopParam);if(consoleWindowExists()){getConsoleWindow().setNewestAtTop(newestMessageAtTop);}};this.isScrollToLatestMessage=function(){return scrollToLatestMessage;};this.setScrollToLatestMessage=function(scrollToLatestMessageParam){scrollToLatestMessage=bool(scrollToLatestMessageParam);if(consoleWindowExists()){getConsoleWindow().setScrollToLatest(scrollToLatestMessage);}};this.getWidth=function(){return width;};this.setWidth=function(widthParam){if(checkCanConfigure("width")){width=extractStringFromParam(widthParam,width);}};this.getHeight=function(){return height;};this.setHeight=function(heightParam){if(checkCanConfigure("height")){height=extractStringFromParam(heightParam,height);}};this.getMaxMessages=function(){return maxMessages;};this.setMaxMessages=function(maxMessagesParam){maxMessages=extractIntFromParam(maxMessagesParam,maxMessages);if(consoleWindowExists()){getConsoleWindow().setMaxMessages(maxMessages);}};this.isShowCommandLine=function(){return showCommandLine;};this.setShowCommandLine=function(showCommandLineParam){showCommandLine=bool(showCommandLineParam);if(consoleWindowExists()){getConsoleWindow().setShowCommandLine(showCommandLine);}};this.isShowHideButton=function(){return showHideButton;};this.setShowHideButton=function(showHideButtonParam){showHideButton=bool(showHideButtonParam);if(consoleWindowExists()){getConsoleWindow().setShowHideButton(showHideButton);}};this.isShowCloseButton=function(){return showCloseButton;};this.setShowCloseButton=function(showCloseButtonParam){showCloseButton=bool(showCloseButtonParam);if(consoleWindowExists()){getConsoleWindow().setShowCloseButton(showCloseButton);}};this.getCommandLineObjectExpansionDepth=function(){return commandLineObjectExpansionDepth;};this.setCommandLineObjectExpansionDepth=function(commandLineObjectExpansionDepthParam){commandLineObjectExpansionDepth=extractIntFromParam(commandLineObjectExpansionDepthParam,commandLineObjectExpansionDepth);};var minimized=initiallyMinimized;this.isInitiallyMinimized=function(){return initiallyMinimized;};this.setInitiallyMinimized=function(initiallyMinimizedParam){if(checkCanConfigure("initiallyMinimized")){initiallyMinimized=bool(initiallyMinimizedParam);minimized=initiallyMinimized;}};this.isUseDocumentWrite=function(){return useDocumentWrite;};this.setUseDocumentWrite=function(useDocumentWriteParam){if(checkCanConfigure("useDocumentWrite")){useDocumentWrite=bool(useDocumentWriteParam);}};function QueuedLoggingEvent(loggingEvent,formattedMessage){this.loggingEvent=loggingEvent;this.levelName=loggingEvent.level.name;this.formattedMessage=formattedMessage;}
QueuedLoggingEvent.prototype.append=function(){getConsoleWindow().log(this.levelName,this.formattedMessage);};function QueuedGroup(name,initiallyExpanded){this.name=name;this.initiallyExpanded=initiallyExpanded;}
QueuedGroup.prototype.append=function(){getConsoleWindow().group(this.name,this.initiallyExpanded);};function QueuedGroupEnd(){}
QueuedGroupEnd.prototype.append=function(){getConsoleWindow().groupEnd();};var checkAndAppend=function(){safeToAppend();if(!initialized){init();}else if(consoleClosed&&reopenWhenClosed){createWindow();}
if(safeToAppend()){appendQueuedLoggingEvents();}};this.append=function(loggingEvent){if(isSupported){var formattedMessage=appender.getLayout().formatWithException(loggingEvent);queuedLoggingEvents.push(new QueuedLoggingEvent(loggingEvent,formattedMessage));checkAndAppend();}};this.group=function(name,initiallyExpanded){if(isSupported){queuedLoggingEvents.push(new QueuedGroup(name,initiallyExpanded));checkAndAppend();}};this.groupEnd=function(){if(isSupported){queuedLoggingEvents.push(new QueuedGroupEnd());checkAndAppend();}};var appendQueuedLoggingEvents=function(){while(queuedLoggingEvents.length>0){queuedLoggingEvents.shift().append();}
if(focusConsoleWindow){getConsoleWindow().focus();}};this.setAddedToLogger=function(logger){this.loggers.push(logger);if(enabled&&!lazyInit){init();}};this.clear=function(){if(consoleWindowExists()){getConsoleWindow().clearLog();}
queuedLoggingEvents.length=0;};this.focus=function(){if(consoleWindowExists()){getConsoleWindow().focus();}};this.focusCommandLine=function(){if(consoleWindowExists()){getConsoleWindow().focusCommandLine();}};this.focusSearch=function(){if(consoleWindowExists()){getConsoleWindow().focusSearch();}};var commandWindow=window;this.getCommandWindow=function(){return commandWindow;};this.setCommandWindow=function(commandWindowParam){commandWindow=commandWindowParam;};this.executeLastCommand=function(){if(consoleWindowExists()){getConsoleWindow().evalLastCommand();}};var commandLayout=new PatternLayout("%m");this.getCommandLayout=function(){return commandLayout;};this.setCommandLayout=function(commandLayoutParam){commandLayout=commandLayoutParam;};this.evalCommandAndAppend=function(expr){var commandReturnValue={appendResult:true,isError:false};var commandOutput="";try{var result,i;if(!commandWindow.eval&&commandWindow.execScript){commandWindow.execScript("null");}
var commandLineFunctionsHash={};for(i=0,len=commandLineFunctions.length;i<len;i++){commandLineFunctionsHash[commandLineFunctions[i][0]]=commandLineFunctions[i][1];}
var objectsToRestore=[];var addObjectToRestore=function(name){objectsToRestore.push([name,commandWindow[name]]);};addObjectToRestore("appender");commandWindow.appender=appender;addObjectToRestore("commandReturnValue");commandWindow.commandReturnValue=commandReturnValue;addObjectToRestore("commandLineFunctionsHash");commandWindow.commandLineFunctionsHash=commandLineFunctionsHash;var addFunctionToWindow=function(name){addObjectToRestore(name);commandWindow[name]=function(){return this.commandLineFunctionsHash[name](appender,arguments,commandReturnValue);};};for(i=0,len=commandLineFunctions.length;i<len;i++){addFunctionToWindow(commandLineFunctions[i][0]);}
if(commandWindow===window&&commandWindow.execScript){addObjectToRestore("evalExpr");addObjectToRestore("result");window.evalExpr=expr;commandWindow.execScript("window.result=eval(window.evalExpr);");result=window.result;}else{result=commandWindow.eval(expr);}
commandOutput=isUndefined(result)?result:formatObjectExpansion(result,commandLineObjectExpansionDepth);for(i=0,len=objectsToRestore.length;i<len;i++){commandWindow[objectsToRestore[i][0]]=objectsToRestore[i][1];}}catch(ex){commandOutput="Error evaluating command: "+getExceptionStringRep(ex);commandReturnValue.isError=true;}
if(commandReturnValue.appendResult){var message=">>> "+expr;if(!isUndefined(commandOutput)){message+=newLine+commandOutput;}
var level=commandReturnValue.isError?Level.ERROR:Level.INFO;var loggingEvent=new LoggingEvent(null,new Date(),level,[message],null);var mainLayout=this.getLayout();this.setLayout(commandLayout);this.append(loggingEvent);this.setLayout(mainLayout);}};var commandLineFunctions=defaultCommandLineFunctions.concat([]);this.addCommandLineFunction=function(functionName,commandLineFunction){commandLineFunctions.push([functionName,commandLineFunction]);};var commandHistoryCookieName="log4javascriptCommandHistory";this.storeCommandHistory=function(commandHistory){setCookie(commandHistoryCookieName,commandHistory.join(","));};var writeHtml=function(doc){var lines=getConsoleHtmlLines();doc.open();for(var i=0,len=lines.length;i<len;i++){doc.writeln(lines[i]);}
doc.close();};this.setEventTypes(["load","unload"]);var consoleWindowLoadHandler=function(){var win=getConsoleWindow();win.setAppender(appender);win.setNewestAtTop(newestMessageAtTop);win.setScrollToLatest(scrollToLatestMessage);win.setMaxMessages(maxMessages);win.setShowCommandLine(showCommandLine);win.setShowHideButton(showHideButton);win.setShowCloseButton(showCloseButton);win.setMainWindow(window);var storedValue=getCookie(commandHistoryCookieName);if(storedValue){win.commandHistory=storedValue.split(",");win.currentCommandIndex=win.commandHistory.length;}
appender.dispatchEvent("load",{"win":win});};this.unload=function(){logLog.debug("unload "+this+", caller: "+this.unload.caller);if(!consoleClosed){logLog.debug("really doing unload "+this);consoleClosed=true;consoleWindowLoaded=false;consoleWindowCreated=false;appender.dispatchEvent("unload",{});}};var pollConsoleWindow=function(windowTest,interval,successCallback,errorMessage){function doPoll(){try{if(consoleClosed){clearInterval(poll);}
if(windowTest(getConsoleWindow())){clearInterval(poll);successCallback();}}catch(ex){clearInterval(poll);isSupported=false;handleError(errorMessage,ex);}}
var poll=setInterval(doPoll,interval);};var getConsoleUrl=function(){var documentDomainSet=(document.domain!=location.hostname);return useDocumentWrite?"":getBaseUrl()+"console.html"+
(documentDomainSet?"?log4javascript_domain="+escape(document.domain):"");};if(inPage){var containerElement=null;var cssProperties=[];this.addCssProperty=function(name,value){if(checkCanConfigure("cssProperties")){cssProperties.push([name,value]);}};var windowCreationStarted=false;var iframeContainerDiv;var iframeId=uniqueId+"_InPageAppender_"+consoleAppenderId;this.hide=function(){if(initialized&&consoleWindowCreated){if(consoleWindowExists()){getConsoleWindow().$("command").blur();}
iframeContainerDiv.style.display="none";minimized=true;}};this.show=function(){if(initialized){if(consoleWindowCreated){iframeContainerDiv.style.display="block";this.setShowCommandLine(showCommandLine);minimized=false;}else if(!windowCreationStarted){createWindow(true);}}};this.isVisible=function(){return!minimized&&!consoleClosed;};this.close=function(fromButton){if(!consoleClosed&&(!fromButton||confirm("This will permanently remove the console from the page. No more messages will be logged. Do you wish to continue?"))){iframeContainerDiv.parentNode.removeChild(iframeContainerDiv);this.unload();}};open=function(){var initErrorMessage="InPageAppender.open: unable to create console iframe";function finalInit(){try{if(!initiallyMinimized){appender.show();}
consoleWindowLoadHandler();consoleWindowLoaded=true;appendQueuedLoggingEvents();}catch(ex){isSupported=false;handleError(initErrorMessage,ex);}}
function writeToDocument(){try{var windowTest=function(win){return isLoaded(win);};if(useDocumentWrite){writeHtml(getConsoleWindow().document);}
if(windowTest(getConsoleWindow())){finalInit();}else{pollConsoleWindow(windowTest,100,finalInit,initErrorMessage);}}catch(ex){isSupported=false;handleError(initErrorMessage,ex);}}
minimized=false;iframeContainerDiv=containerElement.appendChild(document.createElement("div"));iframeContainerDiv.style.width=width;iframeContainerDiv.style.height=height;iframeContainerDiv.style.border="solid gray 1px";for(var i=0,len=cssProperties.length;i<len;i++){iframeContainerDiv.style[cssProperties[i][0]]=cssProperties[i][1];}
var iframeSrc=useDocumentWrite?"":" src='"+getConsoleUrl()+"'";iframeContainerDiv.innerHTML="<iframe id='"+iframeId+"' name='"+iframeId+"' width='100%' height='100%' frameborder='0'"+iframeSrc+" scrolling='no'></iframe>";consoleClosed=false;var iframeDocumentExistsTest=function(win){try{return bool(win)&&bool(win.document);}catch(ex){return false;}};if(iframeDocumentExistsTest(getConsoleWindow())){writeToDocument();}else{pollConsoleWindow(iframeDocumentExistsTest,100,writeToDocument,initErrorMessage);}
consoleWindowCreated=true;};createWindow=function(show){if(show||!initiallyMinimized){var pageLoadHandler=function(){if(!container){containerElement=document.createElement("div");containerElement.style.position="fixed";containerElement.style.left="0";containerElement.style.right="0";containerElement.style.bottom="0";document.body.appendChild(containerElement);appender.addCssProperty("borderWidth","1px 0 0 0");appender.addCssProperty("zIndex",1000000);open();}else{try{var el=document.getElementById(container);if(el.nodeType==1){containerElement=el;}
open();}catch(ex){handleError("InPageAppender.init: invalid container element '"+container+"' supplied",ex);}}};if(pageLoaded&&container&&container.appendChild){containerElement=container;open();}else if(pageLoaded){pageLoadHandler();}else{log4javascript.addEventListener("load",pageLoadHandler);}
windowCreationStarted=true;}};init=function(){createWindow();initialized=true;};getConsoleWindow=function(){var iframe=window.frames[iframeId];if(iframe){return iframe;}};safeToAppend=function(){if(isSupported&&!consoleClosed){if(consoleWindowCreated&&!consoleWindowLoaded&&getConsoleWindow()&&isLoaded(getConsoleWindow())){consoleWindowLoaded=true;}
return consoleWindowLoaded;}
return false;};}else{var useOldPopUp=appender.defaults.useOldPopUp;var complainAboutPopUpBlocking=appender.defaults.complainAboutPopUpBlocking;var reopenWhenClosed=this.defaults.reopenWhenClosed;this.isUseOldPopUp=function(){return useOldPopUp;};this.setUseOldPopUp=function(useOldPopUpParam){if(checkCanConfigure("useOldPopUp")){useOldPopUp=bool(useOldPopUpParam);}};this.isComplainAboutPopUpBlocking=function(){return complainAboutPopUpBlocking;};this.setComplainAboutPopUpBlocking=function(complainAboutPopUpBlockingParam){if(checkCanConfigure("complainAboutPopUpBlocking")){complainAboutPopUpBlocking=bool(complainAboutPopUpBlockingParam);}};this.isFocusPopUp=function(){return focusConsoleWindow;};this.setFocusPopUp=function(focusPopUpParam){focusConsoleWindow=bool(focusPopUpParam);};this.isReopenWhenClosed=function(){return reopenWhenClosed;};this.setReopenWhenClosed=function(reopenWhenClosedParam){reopenWhenClosed=bool(reopenWhenClosedParam);};this.close=function(){logLog.debug("close "+this);try{popUp.close();this.unload();}catch(ex){}};this.hide=function(){logLog.debug("hide "+this);if(consoleWindowExists()){this.close();}};this.show=function(){logLog.debug("show "+this);if(!consoleWindowCreated){open();}};this.isVisible=function(){return safeToAppend();};var popUp;open=function(){var windowProperties="width="+width+",height="+height+",status,resizable";var frameInfo="";try{var frameEl=window.frameElement;if(frameEl){frameInfo="_"+frameEl.tagName+"_"+(frameEl.name||frameEl.id||"");}}catch(e){frameInfo="_inaccessibleParentFrame";}
var windowName="PopUp_"+location.host.replace(/[^a-z0-9]/gi,"_")+"_"+consoleAppenderId+frameInfo;if(!useOldPopUp||!useDocumentWrite){windowName=windowName+"_"+uniqueId;}
var checkPopUpClosed=function(win){if(consoleClosed){return true;}else{try{return bool(win)&&win.closed;}catch(ex){}}
return false;};var popUpClosedCallback=function(){if(!consoleClosed){appender.unload();}};function finalInit(){getConsoleWindow().setCloseIfOpenerCloses(!useOldPopUp||!useDocumentWrite);consoleWindowLoadHandler();consoleWindowLoaded=true;appendQueuedLoggingEvents();pollConsoleWindow(checkPopUpClosed,500,popUpClosedCallback,"PopUpAppender.checkPopUpClosed: error checking pop-up window");}
try{popUp=window.open(getConsoleUrl(),windowName,windowProperties);consoleClosed=false;consoleWindowCreated=true;if(popUp&&popUp.document){if(useDocumentWrite&&useOldPopUp&&isLoaded(popUp)){popUp.mainPageReloaded();finalInit();}else{if(useDocumentWrite){writeHtml(popUp.document);}
var popUpLoadedTest=function(win){return bool(win)&&isLoaded(win);};if(isLoaded(popUp)){finalInit();}else{pollConsoleWindow(popUpLoadedTest,100,finalInit,"PopUpAppender.init: unable to create console window");}}}else{isSupported=false;logLog.warn("PopUpAppender.init: pop-ups blocked, please unblock to use PopUpAppender");if(complainAboutPopUpBlocking){handleError("log4javascript: pop-up windows appear to be blocked. Please unblock them to use pop-up logging.");}}}catch(ex){handleError("PopUpAppender.init: error creating pop-up",ex);}};createWindow=function(){if(!initiallyMinimized){open();}};init=function(){createWindow();initialized=true;};getConsoleWindow=function(){return popUp;};safeToAppend=function(){if(isSupported&&!isUndefined(popUp)&&!consoleClosed){if(popUp.closed||(consoleWindowLoaded&&isUndefined(popUp.closed))){appender.unload();logLog.debug("PopUpAppender: pop-up closed");return false;}
if(!consoleWindowLoaded&&isLoaded(popUp)){consoleWindowLoaded=true;}}
return isSupported&&consoleWindowLoaded&&!consoleClosed;};}
this.getConsoleWindow=getConsoleWindow;};ConsoleAppender.addGlobalCommandLineFunction=function(functionName,commandLineFunction){defaultCommandLineFunctions.push([functionName,commandLineFunction]);};function PopUpAppender(lazyInit,initiallyMinimized,useDocumentWrite,width,height){this.create(false,null,lazyInit,initiallyMinimized,useDocumentWrite,width,height,this.defaults.focusPopUp);}
PopUpAppender.prototype=new ConsoleAppender();PopUpAppender.prototype.defaults={layout:new PatternLayout("%d{HH:mm:ss} %-5p - %m{1}%n"),initiallyMinimized:false,focusPopUp:false,lazyInit:true,useOldPopUp:true,complainAboutPopUpBlocking:true,newestMessageAtTop:false,scrollToLatestMessage:true,width:"600",height:"400",reopenWhenClosed:false,maxMessages:null,showCommandLine:true,commandLineObjectExpansionDepth:1,showHideButton:false,showCloseButton:true,useDocumentWrite:true};PopUpAppender.prototype.toString=function(){return"PopUpAppender";};log4javascript.PopUpAppender=PopUpAppender;function InPageAppender(container,lazyInit,initiallyMinimized,useDocumentWrite,width,height){this.create(true,container,lazyInit,initiallyMinimized,useDocumentWrite,width,height,false);}
InPageAppender.prototype=new ConsoleAppender();InPageAppender.prototype.defaults={layout:new PatternLayout("%d{HH:mm:ss} %-5p - %m{1}%n"),initiallyMinimized:false,lazyInit:true,newestMessageAtTop:false,scrollToLatestMessage:true,width:"100%",height:"220px",maxMessages:null,showCommandLine:true,commandLineObjectExpansionDepth:1,showHideButton:false,showCloseButton:false,showLogEntryDeleteButtons:true,useDocumentWrite:true};InPageAppender.prototype.toString=function(){return"InPageAppender";};log4javascript.InPageAppender=InPageAppender;log4javascript.InlineAppender=InPageAppender;})();function padWithSpaces(str,len){if(str.length<len){var spaces=[];var numberOfSpaces=Math.max(0,len-str.length);for(var i=0;i<numberOfSpaces;i++){spaces[i]=" ";}
str+=spaces.join("");}
return str;}
(function(){function dir(obj){var maxLen=0;for(var p in obj){maxLen=Math.max(toStr(p).length,maxLen);}
var propList=[];for(p in obj){var propNameStr="  "+padWithSpaces(toStr(p),maxLen+2);var propVal;try{propVal=splitIntoLines(toStr(obj[p])).join(padWithSpaces(newLine,maxLen+6));}catch(ex){propVal="[Error obtaining property. Details: "+getExceptionMessage(ex)+"]";}
propList.push(propNameStr+propVal);}
return propList.join(newLine);}
var nodeTypes={ELEMENT_NODE:1,ATTRIBUTE_NODE:2,TEXT_NODE:3,CDATA_SECTION_NODE:4,ENTITY_REFERENCE_NODE:5,ENTITY_NODE:6,PROCESSING_INSTRUCTION_NODE:7,COMMENT_NODE:8,DOCUMENT_NODE:9,DOCUMENT_TYPE_NODE:10,DOCUMENT_FRAGMENT_NODE:11,NOTATION_NODE:12};var preFormattedElements=["script","pre"];var emptyElements=["br","img","hr","param","link","area","input","col","base","meta"];var indentationUnit="  ";function getXhtml(rootNode,includeRootNode,indentation,startNewLine,preformatted){includeRootNode=(typeof includeRootNode=="undefined")?true:!!includeRootNode;if(typeof indentation!="string"){indentation="";}
startNewLine=!!startNewLine;preformatted=!!preformatted;var xhtml;function isWhitespace(node){return((node.nodeType==nodeTypes.TEXT_NODE)&&/^[ \t\r\n]*$/.test(node.nodeValue));}
function fixAttributeValue(attrValue){return attrValue.toString().replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");}
function getStyleAttributeValue(el){var stylePairs=el.style.cssText.split(";");var styleValue="";for(var j=0,len=stylePairs.length;j<len;j++){var nameValueBits=stylePairs[j].split(":");var props=[];if(!/^\s*$/.test(nameValueBits[0])){props.push(trim(nameValueBits[0]).toLowerCase()+":"+trim(nameValueBits[1]));}
styleValue=props.join(";");}
return styleValue;}
function getNamespace(el){if(el.prefix){return el.prefix;}else if(el.outerHTML){var regex=new RegExp("<([^:]+):"+el.tagName+"[^>]*>","i");if(regex.test(el.outerHTML)){return RegExp.$1.toLowerCase();}}
return"";}
var lt="<";var gt=">";var i,len;if(includeRootNode&&rootNode.nodeType!=nodeTypes.DOCUMENT_FRAGMENT_NODE){switch(rootNode.nodeType){case nodeTypes.ELEMENT_NODE:var tagName=rootNode.tagName.toLowerCase();xhtml=startNewLine?newLine+indentation:"";xhtml+=lt;var prefix=getNamespace(rootNode);var hasPrefix=!!prefix;if(hasPrefix){xhtml+=prefix+":";}
xhtml+=tagName;for(i=0,len=rootNode.attributes.length;i<len;i++){var currentAttr=rootNode.attributes[i];if(!currentAttr.specified||currentAttr.nodeValue===null||currentAttr.nodeName.toLowerCase()==="style"||typeof currentAttr.nodeValue!=="string"||currentAttr.nodeName.indexOf("_moz")===0){continue;}
xhtml+=" "+currentAttr.nodeName.toLowerCase()+"=\"";xhtml+=fixAttributeValue(currentAttr.nodeValue);xhtml+="\"";}
if(rootNode.style.cssText){var styleValue=getStyleAttributeValue(rootNode);if(styleValue!==""){xhtml+=" style=\""+getStyleAttributeValue(rootNode)+"\"";}}
if(array_contains(emptyElements,tagName)||(hasPrefix&&!rootNode.hasChildNodes())){xhtml+="/"+gt;}else{xhtml+=gt;var childStartNewLine=!(rootNode.childNodes.length===1&&rootNode.childNodes[0].nodeType===nodeTypes.TEXT_NODE);var childPreformatted=array_contains(preFormattedElements,tagName);for(i=0,len=rootNode.childNodes.length;i<len;i++){xhtml+=getXhtml(rootNode.childNodes[i],true,indentation+indentationUnit,childStartNewLine,childPreformatted);}
var endTag=lt+"/"+tagName+gt;xhtml+=childStartNewLine?newLine+indentation+endTag:endTag;}
return xhtml;case nodeTypes.TEXT_NODE:if(isWhitespace(rootNode)){xhtml="";}else{if(preformatted){xhtml=rootNode.nodeValue;}else{var lines=splitIntoLines(trim(rootNode.nodeValue));var trimmedLines=[];for(i=0,len=lines.length;i<len;i++){trimmedLines[i]=trim(lines[i]);}
xhtml=trimmedLines.join(newLine+indentation);}
if(startNewLine){xhtml=newLine+indentation+xhtml;}}
return xhtml;case nodeTypes.CDATA_SECTION_NODE:return"<![CDA"+"TA["+rootNode.nodeValue+"]"+"]>"+newLine;case nodeTypes.DOCUMENT_NODE:xhtml="";for(i=0,len=rootNode.childNodes.length;i<len;i++){xhtml+=getXhtml(rootNode.childNodes[i],true,indentation);}
return xhtml;default:return"";}}else{xhtml="";for(i=0,len=rootNode.childNodes.length;i<len;i++){xhtml+=getXhtml(rootNode.childNodes[i],true,indentation+indentationUnit);}
return xhtml;}}
function createCommandLineFunctions(){ConsoleAppender.addGlobalCommandLineFunction("$",function(appender,args,returnValue){return document.getElementById(args[0]);});ConsoleAppender.addGlobalCommandLineFunction("dir",function(appender,args,returnValue){var lines=[];for(var i=0,len=args.length;i<len;i++){lines[i]=dir(args[i]);}
return lines.join(newLine+newLine);});ConsoleAppender.addGlobalCommandLineFunction("dirxml",function(appender,args,returnValue){var lines=[];for(var i=0,len=args.length;i<len;i++){lines[i]=getXhtml(args[i]);}
return lines.join(newLine+newLine);});ConsoleAppender.addGlobalCommandLineFunction("cd",function(appender,args,returnValue){var win,message;if(args.length===0||args[0]===""){win=window;message="Command line set to run in main window";}else{if(args[0].window==args[0]){win=args[0];message="Command line set to run in frame '"+args[0].name+"'";}else{win=window.frames[args[0]];if(win){message="Command line set to run in frame '"+args[0]+"'";}else{returnValue.isError=true;message="Frame '"+args[0]+"' does not exist";win=appender.getCommandWindow();}}}
appender.setCommandWindow(win);return message;});ConsoleAppender.addGlobalCommandLineFunction("clear",function(appender,args,returnValue){returnValue.appendResult=false;appender.clear();});ConsoleAppender.addGlobalCommandLineFunction("keys",function(appender,args,returnValue){var keys=[];for(var k in args[0]){keys.push(k);}
return keys;});ConsoleAppender.addGlobalCommandLineFunction("values",function(appender,args,returnValue){var values=[];for(var k in args[0]){try{values.push(args[0][k]);}catch(ex){logLog.warn("values(): Unable to obtain value for key "+k+". Details: "+getExceptionMessage(ex));}}
return values;});ConsoleAppender.addGlobalCommandLineFunction("expansionDepth",function(appender,args,returnValue){var expansionDepth=parseInt(args[0],10);if(isNaN(expansionDepth)||expansionDepth<0){returnValue.isError=true;return""+args[0]+" is not a valid expansion depth";}else{appender.setCommandLineObjectExpansionDepth(expansionDepth);return"Object expansion depth set to "+expansionDepth;}});}
function init(){createCommandLineFunctions();}
init();})();function createDefaultLogger(){var logger=log4javascript.getLogger(defaultLoggerName);var a=new log4javascript.PopUpAppender();logger.addAppender(a);return logger;}
log4javascript.setDocumentReady=function(){pageLoaded=true;log4javascript.dispatchEvent("load",{});};if(window.addEventListener){window.addEventListener("load",log4javascript.setDocumentReady,false);}else if(window.attachEvent){window.attachEvent("onload",log4javascript.setDocumentReady);}else{var oldOnload=window.onload;if(typeof window.onload!="function"){window.onload=log4javascript.setDocumentReady;}else{window.onload=function(evt){if(oldOnload){oldOnload(evt);}
log4javascript.setDocumentReady();};}}
return log4javascript;},this);

},{}],98:[function(_dereq_,module,exports){
!function(t,r){"object"==typeof exports&&"object"==typeof module?module.exports=r():"function"==typeof define&&define.amd?define([],r):"object"==typeof exports?exports.MessageFormat=r():t.MessageFormat=r()}(this,function(){return function(t){var r={};function e(n){if(r[n])return r[n].exports;var o=r[n]={i:n,l:!1,exports:{}};return t[n].call(o.exports,o,o.exports,e),o.l=!0,o.exports}return e.m=t,e.c=r,e.d=function(t,r,n){e.o(t,r)||Object.defineProperty(t,r,{enumerable:!0,get:n})},e.r=function(t){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})},e.t=function(t,r){if(1&r&&(t=e(t)),8&r)return t;if(4&r&&"object"==typeof t&&t&&t.__esModule)return t;var n=Object.create(null);if(e.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:t}),2&r&&"string"!=typeof t)for(var o in t)e.d(n,o,function(r){return t[r]}.bind(null,o));return n},e.n=function(t){var r=t&&t.__esModule?function(){return t.default}:function(){return t};return e.d(r,"a",r),r},e.o=function(t,r){return Object.prototype.hasOwnProperty.call(t,r)},e.p="",e(e.s=8)}([function(t,r,e){var n,o;void 0===(o="function"==typeof(n={af:function(t,r){return r?"other":1==t?"one":"other"},ak:function(t,r){return r?"other":0==t||1==t?"one":"other"},am:function(t,r){return r?"other":t>=0&&t<=1?"one":"other"},ar:function(t,r){var e=String(t).split("."),n=Number(e[0])==t,o=n&&e[0].slice(-2);return r?"other":0==t?"zero":1==t?"one":2==t?"two":o>=3&&o<=10?"few":o>=11&&o<=99?"many":"other"},ars:function(t,r){var e=String(t).split("."),n=Number(e[0])==t,o=n&&e[0].slice(-2);return r?"other":0==t?"zero":1==t?"one":2==t?"two":o>=3&&o<=10?"few":o>=11&&o<=99?"many":"other"},as:function(t,r){return r?1==t||5==t||7==t||8==t||9==t||10==t?"one":2==t||3==t?"two":4==t?"few":6==t?"many":"other":t>=0&&t<=1?"one":"other"},asa:function(t,r){return r?"other":1==t?"one":"other"},ast:function(t,r){var e=String(t).split("."),n=!e[1];return r?"other":1==t&&n?"one":"other"},az:function(t,r){var e=String(t).split("."),n=e[0],o=n.slice(-1),i=n.slice(-2),u=n.slice(-3);return r?1==o||2==o||5==o||7==o||8==o||20==i||50==i||70==i||80==i?"one":3==o||4==o||100==u||200==u||300==u||400==u||500==u||600==u||700==u||800==u||900==u?"few":0==n||6==o||40==i||60==i||90==i?"many":"other":1==t?"one":"other"},be:function(t,r){var e=String(t).split("."),n=Number(e[0])==t,o=n&&e[0].slice(-1),i=n&&e[0].slice(-2);return r?2!=o&&3!=o||12==i||13==i?"other":"few":1==o&&11!=i?"one":o>=2&&o<=4&&(i<12||i>14)?"few":n&&0==o||o>=5&&o<=9||i>=11&&i<=14?"many":"other"},bem:function(t,r){return r?"other":1==t?"one":"other"},bez:function(t,r){return r?"other":1==t?"one":"other"},bg:function(t,r){return r?"other":1==t?"one":"other"},bh:function(t,r){return r?"other":0==t||1==t?"one":"other"},bm:function(t,r){return"other"},bn:function(t,r){return r?1==t||5==t||7==t||8==t||9==t||10==t?"one":2==t||3==t?"two":4==t?"few":6==t?"many":"other":t>=0&&t<=1?"one":"other"},bo:function(t,r){return"other"},br:function(t,r){var e=String(t).split("."),n=Number(e[0])==t,o=n&&e[0].slice(-1),i=n&&e[0].slice(-2),u=n&&e[0].slice(-6);return r?"other":1==o&&11!=i&&71!=i&&91!=i?"one":2==o&&12!=i&&72!=i&&92!=i?"two":(3==o||4==o||9==o)&&(i<10||i>19)&&(i<70||i>79)&&(i<90||i>99)?"few":0!=t&&n&&0==u?"many":"other"},brx:function(t,r){return r?"other":1==t?"one":"other"},bs:function(t,r){var e=String(t).split("."),n=e[0],o=e[1]||"",i=!e[1],u=n.slice(-1),a=n.slice(-2),c=o.slice(-1),h=o.slice(-2);return r?"other":i&&1==u&&11!=a||1==c&&11!=h?"one":i&&u>=2&&u<=4&&(a<12||a>14)||c>=2&&c<=4&&(h<12||h>14)?"few":"other"},ca:function(t,r){var e=String(t).split("."),n=!e[1];return r?1==t||3==t?"one":2==t?"two":4==t?"few":"other":1==t&&n?"one":"other"},ce:function(t,r){return r?"other":1==t?"one":"other"},cgg:function(t,r){return r?"other":1==t?"one":"other"},chr:function(t,r){return r?"other":1==t?"one":"other"},ckb:function(t,r){return r?"other":1==t?"one":"other"},cs:function(t,r){var e=String(t).split("."),n=e[0],o=!e[1];return r?"other":1==t&&o?"one":n>=2&&n<=4&&o?"few":o?"other":"many"},cy:function(t,r){return r?0==t||7==t||8==t||9==t?"zero":1==t?"one":2==t?"two":3==t||4==t?"few":5==t||6==t?"many":"other":0==t?"zero":1==t?"one":2==t?"two":3==t?"few":6==t?"many":"other"},da:function(t,r){var e=String(t).split("."),n=e[0],o=Number(e[0])==t;return r?"other":1!=t&&(o||0!=n&&1!=n)?"other":"one"},de:function(t,r){var e=String(t).split("."),n=!e[1];return r?"other":1==t&&n?"one":"other"},dsb:function(t,r){var e=String(t).split("."),n=e[0],o=e[1]||"",i=!e[1],u=n.slice(-2),a=o.slice(-2);return r?"other":i&&1==u||1==a?"one":i&&2==u||2==a?"two":i&&(3==u||4==u)||3==a||4==a?"few":"other"},dv:function(t,r){return r?"other":1==t?"one":"other"},dz:function(t,r){return"other"},ee:function(t,r){return r?"other":1==t?"one":"other"},el:function(t,r){return r?"other":1==t?"one":"other"},en:function(t,r){var e=String(t).split("."),n=!e[1],o=Number(e[0])==t,i=o&&e[0].slice(-1),u=o&&e[0].slice(-2);return r?1==i&&11!=u?"one":2==i&&12!=u?"two":3==i&&13!=u?"few":"other":1==t&&n?"one":"other"},eo:function(t,r){return r?"other":1==t?"one":"other"},es:function(t,r){return r?"other":1==t?"one":"other"},et:function(t,r){var e=String(t).split("."),n=!e[1];return r?"other":1==t&&n?"one":"other"},eu:function(t,r){return r?"other":1==t?"one":"other"},fa:function(t,r){return r?"other":t>=0&&t<=1?"one":"other"},ff:function(t,r){return r?"other":t>=0&&t<2?"one":"other"},fi:function(t,r){var e=String(t).split("."),n=!e[1];return r?"other":1==t&&n?"one":"other"},fil:function(t,r){var e=String(t).split("."),n=e[0],o=e[1]||"",i=!e[1],u=n.slice(-1),a=o.slice(-1);return r?1==t?"one":"other":i&&(1==n||2==n||3==n)||i&&4!=u&&6!=u&&9!=u||!i&&4!=a&&6!=a&&9!=a?"one":"other"},fo:function(t,r){return r?"other":1==t?"one":"other"},fr:function(t,r){return r?1==t?"one":"other":t>=0&&t<2?"one":"other"},fur:function(t,r){return r?"other":1==t?"one":"other"},fy:function(t,r){var e=String(t).split("."),n=!e[1];return r?"other":1==t&&n?"one":"other"},ga:function(t,r){var e=String(t).split("."),n=Number(e[0])==t;return r?1==t?"one":"other":1==t?"one":2==t?"two":n&&t>=3&&t<=6?"few":n&&t>=7&&t<=10?"many":"other"},gd:function(t,r){var e=String(t).split("."),n=Number(e[0])==t;return r?1==t||11==t?"one":2==t||12==t?"two":3==t||13==t?"few":"other":1==t||11==t?"one":2==t||12==t?"two":n&&t>=3&&t<=10||n&&t>=13&&t<=19?"few":"other"},gl:function(t,r){var e=String(t).split("."),n=!e[1];return r?"other":1==t&&n?"one":"other"},gsw:function(t,r){return r?"other":1==t?"one":"other"},gu:function(t,r){return r?1==t?"one":2==t||3==t?"two":4==t?"few":6==t?"many":"other":t>=0&&t<=1?"one":"other"},guw:function(t,r){return r?"other":0==t||1==t?"one":"other"},gv:function(t,r){var e=String(t).split("."),n=e[0],o=!e[1],i=n.slice(-1),u=n.slice(-2);return r?"other":o&&1==i?"one":o&&2==i?"two":!o||0!=u&&20!=u&&40!=u&&60!=u&&80!=u?o?"other":"many":"few"},ha:function(t,r){return r?"other":1==t?"one":"other"},haw:function(t,r){return r?"other":1==t?"one":"other"},he:function(t,r){var e=String(t).split("."),n=e[0],o=!e[1],i=Number(e[0])==t,u=i&&e[0].slice(-1);return r?"other":1==t&&o?"one":2==n&&o?"two":o&&(t<0||t>10)&&i&&0==u?"many":"other"},hi:function(t,r){return r?1==t?"one":2==t||3==t?"two":4==t?"few":6==t?"many":"other":t>=0&&t<=1?"one":"other"},hr:function(t,r){var e=String(t).split("."),n=e[0],o=e[1]||"",i=!e[1],u=n.slice(-1),a=n.slice(-2),c=o.slice(-1),h=o.slice(-2);return r?"other":i&&1==u&&11!=a||1==c&&11!=h?"one":i&&u>=2&&u<=4&&(a<12||a>14)||c>=2&&c<=4&&(h<12||h>14)?"few":"other"},hsb:function(t,r){var e=String(t).split("."),n=e[0],o=e[1]||"",i=!e[1],u=n.slice(-2),a=o.slice(-2);return r?"other":i&&1==u||1==a?"one":i&&2==u||2==a?"two":i&&(3==u||4==u)||3==a||4==a?"few":"other"},hu:function(t,r){return r?1==t||5==t?"one":"other":1==t?"one":"other"},hy:function(t,r){return r?1==t?"one":"other":t>=0&&t<2?"one":"other"},ia:function(t,r){var e=String(t).split("."),n=!e[1];return r?"other":1==t&&n?"one":"other"},id:function(t,r){return"other"},ig:function(t,r){return"other"},ii:function(t,r){return"other"},in:function(t,r){return"other"},io:function(t,r){var e=String(t).split("."),n=!e[1];return r?"other":1==t&&n?"one":"other"},is:function(t,r){var e=String(t).split("."),n=e[0],o=Number(e[0])==t,i=n.slice(-1),u=n.slice(-2);return r?"other":o&&1==i&&11!=u||!o?"one":"other"},it:function(t,r){var e=String(t).split("."),n=!e[1];return r?11==t||8==t||80==t||800==t?"many":"other":1==t&&n?"one":"other"},iu:function(t,r){return r?"other":1==t?"one":2==t?"two":"other"},iw:function(t,r){var e=String(t).split("."),n=e[0],o=!e[1],i=Number(e[0])==t,u=i&&e[0].slice(-1);return r?"other":1==t&&o?"one":2==n&&o?"two":o&&(t<0||t>10)&&i&&0==u?"many":"other"},ja:function(t,r){return"other"},jbo:function(t,r){return"other"},jgo:function(t,r){return r?"other":1==t?"one":"other"},ji:function(t,r){var e=String(t).split("."),n=!e[1];return r?"other":1==t&&n?"one":"other"},jmc:function(t,r){return r?"other":1==t?"one":"other"},jv:function(t,r){return"other"},jw:function(t,r){return"other"},ka:function(t,r){var e=String(t).split("."),n=e[0],o=n.slice(-2);return r?1==n?"one":0==n||o>=2&&o<=20||40==o||60==o||80==o?"many":"other":1==t?"one":"other"},kab:function(t,r){return r?"other":t>=0&&t<2?"one":"other"},kaj:function(t,r){return r?"other":1==t?"one":"other"},kcg:function(t,r){return r?"other":1==t?"one":"other"},kde:function(t,r){return"other"},kea:function(t,r){return"other"},kk:function(t,r){var e=String(t).split("."),n=Number(e[0])==t,o=n&&e[0].slice(-1);return r?6==o||9==o||n&&0==o&&0!=t?"many":"other":1==t?"one":"other"},kkj:function(t,r){return r?"other":1==t?"one":"other"},kl:function(t,r){return r?"other":1==t?"one":"other"},km:function(t,r){return"other"},kn:function(t,r){return r?"other":t>=0&&t<=1?"one":"other"},ko:function(t,r){return"other"},ks:function(t,r){return r?"other":1==t?"one":"other"},ksb:function(t,r){return r?"other":1==t?"one":"other"},ksh:function(t,r){return r?"other":0==t?"zero":1==t?"one":"other"},ku:function(t,r){return r?"other":1==t?"one":"other"},kw:function(t,r){return r?"other":1==t?"one":2==t?"two":"other"},ky:function(t,r){return r?"other":1==t?"one":"other"},lag:function(t,r){var e=String(t).split("."),n=e[0];return r?"other":0==t?"zero":0!=n&&1!=n||0==t?"other":"one"},lb:function(t,r){return r?"other":1==t?"one":"other"},lg:function(t,r){return r?"other":1==t?"one":"other"},lkt:function(t,r){return"other"},ln:function(t,r){return r?"other":0==t||1==t?"one":"other"},lo:function(t,r){return r&&1==t?"one":"other"},lt:function(t,r){var e=String(t).split("."),n=e[1]||"",o=Number(e[0])==t,i=o&&e[0].slice(-1),u=o&&e[0].slice(-2);return r?"other":1==i&&(u<11||u>19)?"one":i>=2&&i<=9&&(u<11||u>19)?"few":0!=n?"many":"other"},lv:function(t,r){var e=String(t).split("."),n=e[1]||"",o=n.length,i=Number(e[0])==t,u=i&&e[0].slice(-1),a=i&&e[0].slice(-2),c=n.slice(-2),h=n.slice(-1);return r?"other":i&&0==u||a>=11&&a<=19||2==o&&c>=11&&c<=19?"zero":1==u&&11!=a||2==o&&1==h&&11!=c||2!=o&&1==h?"one":"other"},mas:function(t,r){return r?"other":1==t?"one":"other"},mg:function(t,r){return r?"other":0==t||1==t?"one":"other"},mgo:function(t,r){return r?"other":1==t?"one":"other"},mk:function(t,r){var e=String(t).split("."),n=e[0],o=e[1]||"",i=!e[1],u=n.slice(-1),a=n.slice(-2),c=o.slice(-1),h=o.slice(-2);return r?1==u&&11!=a?"one":2==u&&12!=a?"two":7!=u&&8!=u||17==a||18==a?"other":"many":i&&1==u&&11!=a||1==c&&11!=h?"one":"other"},ml:function(t,r){return r?"other":1==t?"one":"other"},mn:function(t,r){return r?"other":1==t?"one":"other"},mo:function(t,r){var e=String(t).split("."),n=!e[1],o=Number(e[0])==t,i=o&&e[0].slice(-2);return r?1==t?"one":"other":1==t&&n?"one":!n||0==t||1!=t&&i>=1&&i<=19?"few":"other"},mr:function(t,r){return r?1==t?"one":2==t||3==t?"two":4==t?"few":"other":t>=0&&t<=1?"one":"other"},ms:function(t,r){return r&&1==t?"one":"other"},mt:function(t,r){var e=String(t).split("."),n=Number(e[0])==t,o=n&&e[0].slice(-2);return r?"other":1==t?"one":0==t||o>=2&&o<=10?"few":o>=11&&o<=19?"many":"other"},my:function(t,r){return"other"},nah:function(t,r){return r?"other":1==t?"one":"other"},naq:function(t,r){return r?"other":1==t?"one":2==t?"two":"other"},nb:function(t,r){return r?"other":1==t?"one":"other"},nd:function(t,r){return r?"other":1==t?"one":"other"},ne:function(t,r){var e=String(t).split("."),n=Number(e[0])==t;return r?n&&t>=1&&t<=4?"one":"other":1==t?"one":"other"},nl:function(t,r){var e=String(t).split("."),n=!e[1];return r?"other":1==t&&n?"one":"other"},nn:function(t,r){return r?"other":1==t?"one":"other"},nnh:function(t,r){return r?"other":1==t?"one":"other"},no:function(t,r){return r?"other":1==t?"one":"other"},nqo:function(t,r){return"other"},nr:function(t,r){return r?"other":1==t?"one":"other"},nso:function(t,r){return r?"other":0==t||1==t?"one":"other"},ny:function(t,r){return r?"other":1==t?"one":"other"},nyn:function(t,r){return r?"other":1==t?"one":"other"},om:function(t,r){return r?"other":1==t?"one":"other"},or:function(t,r){var e=String(t).split("."),n=Number(e[0])==t;return r?1==t||5==t||n&&t>=7&&t<=9?"one":2==t||3==t?"two":4==t?"few":6==t?"many":"other":1==t?"one":"other"},os:function(t,r){return r?"other":1==t?"one":"other"},pa:function(t,r){return r?"other":0==t||1==t?"one":"other"},pap:function(t,r){return r?"other":1==t?"one":"other"},pl:function(t,r){var e=String(t).split("."),n=e[0],o=!e[1],i=n.slice(-1),u=n.slice(-2);return r?"other":1==t&&o?"one":o&&i>=2&&i<=4&&(u<12||u>14)?"few":o&&1!=n&&(0==i||1==i)||o&&i>=5&&i<=9||o&&u>=12&&u<=14?"many":"other"},prg:function(t,r){var e=String(t).split("."),n=e[1]||"",o=n.length,i=Number(e[0])==t,u=i&&e[0].slice(-1),a=i&&e[0].slice(-2),c=n.slice(-2),h=n.slice(-1);return r?"other":i&&0==u||a>=11&&a<=19||2==o&&c>=11&&c<=19?"zero":1==u&&11!=a||2==o&&1==h&&11!=c||2!=o&&1==h?"one":"other"},ps:function(t,r){return r?"other":1==t?"one":"other"},pt:function(t,r){var e=String(t).split("."),n=e[0];return r?"other":0==n||1==n?"one":"other"},"pt-PT":function(t,r){var e=String(t).split("."),n=!e[1];return r?"other":1==t&&n?"one":"other"},rm:function(t,r){return r?"other":1==t?"one":"other"},ro:function(t,r){var e=String(t).split("."),n=!e[1],o=Number(e[0])==t,i=o&&e[0].slice(-2);return r?1==t?"one":"other":1==t&&n?"one":!n||0==t||1!=t&&i>=1&&i<=19?"few":"other"},rof:function(t,r){return r?"other":1==t?"one":"other"},root:function(t,r){return"other"},ru:function(t,r){var e=String(t).split("."),n=e[0],o=!e[1],i=n.slice(-1),u=n.slice(-2);return r?"other":o&&1==i&&11!=u?"one":o&&i>=2&&i<=4&&(u<12||u>14)?"few":o&&0==i||o&&i>=5&&i<=9||o&&u>=11&&u<=14?"many":"other"},rwk:function(t,r){return r?"other":1==t?"one":"other"},sah:function(t,r){return"other"},saq:function(t,r){return r?"other":1==t?"one":"other"},sc:function(t,r){var e=String(t).split("."),n=!e[1];return r?11==t||8==t||80==t||800==t?"many":"other":1==t&&n?"one":"other"},scn:function(t,r){var e=String(t).split("."),n=!e[1];return r?11==t||8==t||80==t||800==t?"many":"other":1==t&&n?"one":"other"},sd:function(t,r){return r?"other":1==t?"one":"other"},sdh:function(t,r){return r?"other":1==t?"one":"other"},se:function(t,r){return r?"other":1==t?"one":2==t?"two":"other"},seh:function(t,r){return r?"other":1==t?"one":"other"},ses:function(t,r){return"other"},sg:function(t,r){return"other"},sh:function(t,r){var e=String(t).split("."),n=e[0],o=e[1]||"",i=!e[1],u=n.slice(-1),a=n.slice(-2),c=o.slice(-1),h=o.slice(-2);return r?"other":i&&1==u&&11!=a||1==c&&11!=h?"one":i&&u>=2&&u<=4&&(a<12||a>14)||c>=2&&c<=4&&(h<12||h>14)?"few":"other"},shi:function(t,r){var e=String(t).split("."),n=Number(e[0])==t;return r?"other":t>=0&&t<=1?"one":n&&t>=2&&t<=10?"few":"other"},si:function(t,r){var e=String(t).split("."),n=e[0],o=e[1]||"";return r?"other":0==t||1==t||0==n&&1==o?"one":"other"},sk:function(t,r){var e=String(t).split("."),n=e[0],o=!e[1];return r?"other":1==t&&o?"one":n>=2&&n<=4&&o?"few":o?"other":"many"},sl:function(t,r){var e=String(t).split("."),n=e[0],o=!e[1],i=n.slice(-2);return r?"other":o&&1==i?"one":o&&2==i?"two":o&&(3==i||4==i)||!o?"few":"other"},sma:function(t,r){return r?"other":1==t?"one":2==t?"two":"other"},smi:function(t,r){return r?"other":1==t?"one":2==t?"two":"other"},smj:function(t,r){return r?"other":1==t?"one":2==t?"two":"other"},smn:function(t,r){return r?"other":1==t?"one":2==t?"two":"other"},sms:function(t,r){return r?"other":1==t?"one":2==t?"two":"other"},sn:function(t,r){return r?"other":1==t?"one":"other"},so:function(t,r){return r?"other":1==t?"one":"other"},sq:function(t,r){var e=String(t).split("."),n=Number(e[0])==t,o=n&&e[0].slice(-1),i=n&&e[0].slice(-2);return r?1==t?"one":4==o&&14!=i?"many":"other":1==t?"one":"other"},sr:function(t,r){var e=String(t).split("."),n=e[0],o=e[1]||"",i=!e[1],u=n.slice(-1),a=n.slice(-2),c=o.slice(-1),h=o.slice(-2);return r?"other":i&&1==u&&11!=a||1==c&&11!=h?"one":i&&u>=2&&u<=4&&(a<12||a>14)||c>=2&&c<=4&&(h<12||h>14)?"few":"other"},ss:function(t,r){return r?"other":1==t?"one":"other"},ssy:function(t,r){return r?"other":1==t?"one":"other"},st:function(t,r){return r?"other":1==t?"one":"other"},sv:function(t,r){var e=String(t).split("."),n=!e[1],o=Number(e[0])==t,i=o&&e[0].slice(-1),u=o&&e[0].slice(-2);return r?1!=i&&2!=i||11==u||12==u?"other":"one":1==t&&n?"one":"other"},sw:function(t,r){var e=String(t).split("."),n=!e[1];return r?"other":1==t&&n?"one":"other"},syr:function(t,r){return r?"other":1==t?"one":"other"},ta:function(t,r){return r?"other":1==t?"one":"other"},te:function(t,r){return r?"other":1==t?"one":"other"},teo:function(t,r){return r?"other":1==t?"one":"other"},th:function(t,r){return"other"},ti:function(t,r){return r?"other":0==t||1==t?"one":"other"},tig:function(t,r){return r?"other":1==t?"one":"other"},tk:function(t,r){var e=String(t).split("."),n=Number(e[0])==t,o=n&&e[0].slice(-1);return r?6==o||9==o||10==t?"few":"other":1==t?"one":"other"},tl:function(t,r){var e=String(t).split("."),n=e[0],o=e[1]||"",i=!e[1],u=n.slice(-1),a=o.slice(-1);return r?1==t?"one":"other":i&&(1==n||2==n||3==n)||i&&4!=u&&6!=u&&9!=u||!i&&4!=a&&6!=a&&9!=a?"one":"other"},tn:function(t,r){return r?"other":1==t?"one":"other"},to:function(t,r){return"other"},tr:function(t,r){return r?"other":1==t?"one":"other"},ts:function(t,r){return r?"other":1==t?"one":"other"},tzm:function(t,r){var e=String(t).split("."),n=Number(e[0])==t;return r?"other":0==t||1==t||n&&t>=11&&t<=99?"one":"other"},ug:function(t,r){return r?"other":1==t?"one":"other"},uk:function(t,r){var e=String(t).split("."),n=e[0],o=!e[1],i=Number(e[0])==t,u=i&&e[0].slice(-1),a=i&&e[0].slice(-2),c=n.slice(-1),h=n.slice(-2);return r?3==u&&13!=a?"few":"other":o&&1==c&&11!=h?"one":o&&c>=2&&c<=4&&(h<12||h>14)?"few":o&&0==c||o&&c>=5&&c<=9||o&&h>=11&&h<=14?"many":"other"},ur:function(t,r){var e=String(t).split("."),n=!e[1];return r?"other":1==t&&n?"one":"other"},uz:function(t,r){return r?"other":1==t?"one":"other"},ve:function(t,r){return r?"other":1==t?"one":"other"},vi:function(t,r){return r&&1==t?"one":"other"},vo:function(t,r){return r?"other":1==t?"one":"other"},vun:function(t,r){return r?"other":1==t?"one":"other"},wa:function(t,r){return r?"other":0==t||1==t?"one":"other"},wae:function(t,r){return r?"other":1==t?"one":"other"},wo:function(t,r){return"other"},xh:function(t,r){return r?"other":1==t?"one":"other"},xog:function(t,r){return r?"other":1==t?"one":"other"},yi:function(t,r){var e=String(t).split("."),n=!e[1];return r?"other":1==t&&n?"one":"other"},yo:function(t,r){return"other"},yue:function(t,r){return"other"},zh:function(t,r){return"other"},zu:function(t,r){return r?"other":t>=0&&t<=1?"one":"other"}})?n.call(r,e,r,t):n)||(t.exports=o)},function(t,r,e){t.exports={date:e(4),duration:e(5),number:e(6),time:e(7)}},function(t,r,e){"use strict";function n(t,r,e,o){this.message=t,this.expected=r,this.found=e,this.location=o,this.name="SyntaxError","function"==typeof Error.captureStackTrace&&Error.captureStackTrace(this,n)}!function(t,r){function e(){this.constructor=t}e.prototype=r.prototype,t.prototype=new e}(n,Error),n.buildMessage=function(t,r){var e={literal:function(t){return'"'+o(t.text)+'"'},class:function(t){var r,e="";for(r=0;r<t.parts.length;r++)e+=t.parts[r]instanceof Array?i(t.parts[r][0])+"-"+i(t.parts[r][1]):i(t.parts[r]);return"["+(t.inverted?"^":"")+e+"]"},any:function(t){return"any character"},end:function(t){return"end of input"},other:function(t){return t.description}};function n(t){return t.charCodeAt(0).toString(16).toUpperCase()}function o(t){return t.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\0/g,"\\0").replace(/\t/g,"\\t").replace(/\n/g,"\\n").replace(/\r/g,"\\r").replace(/[\x00-\x0F]/g,function(t){return"\\x0"+n(t)}).replace(/[\x10-\x1F\x7F-\x9F]/g,function(t){return"\\x"+n(t)})}function i(t){return t.replace(/\\/g,"\\\\").replace(/\]/g,"\\]").replace(/\^/g,"\\^").replace(/-/g,"\\-").replace(/\0/g,"\\0").replace(/\t/g,"\\t").replace(/\n/g,"\\n").replace(/\r/g,"\\r").replace(/[\x00-\x0F]/g,function(t){return"\\x0"+n(t)}).replace(/[\x10-\x1F\x7F-\x9F]/g,function(t){return"\\x"+n(t)})}return"Expected "+function(t){var r,n,o,i=new Array(t.length);for(r=0;r<t.length;r++)i[r]=(o=t[r],e[o.type](o));if(i.sort(),i.length>0){for(r=1,n=1;r<i.length;r++)i[r-1]!==i[r]&&(i[n]=i[r],n++);i.length=n}switch(i.length){case 1:return i[0];case 2:return i[0]+" or "+i[1];default:return i.slice(0,-1).join(", ")+", or "+i[i.length-1]}}(t)+" but "+function(t){return t?'"'+o(t)+'"':"end of input"}(r)+" found."},t.exports={SyntaxError:n,parse:function(t,r){r=void 0!==r?r:{};var e,o={},i={start:tr},u=tr,a="#",c=It("#",!1),h=function(){return pr[0]},f=function(){return{type:"octothorpe"}},s=function(t){return t.join("")},l="{",p=It("{",!1),m="}",d=It("}",!1),y=function(t){return{type:"argument",arg:t}},g=",",v=It(",",!1),w="select",b=It("select",!1),S=function(t,e){return r.strict&&pr.unshift(!1),e},k=function(t,e){return r.strict&&pr.shift(),{type:"select",arg:t,cases:e}},x="plural",A=It("plural",!1),j="selectordinal",N=It("selectordinal",!1),C=function(t,r){return pr.unshift(!0),r},F=function(t,e,n,o){var i=("selectordinal"===e?r.ordinal:r.cardinal)||["zero","one","two","few","many","other"];return i&&i.length&&o.forEach(function(r){if(isNaN(r.key)&&i.indexOf(r.key)<0)throw new Error("Invalid key `"+r.key+"` for argument `"+t+"`. Valid "+e+" keys for this locale are `"+i.join("`, `")+"`, and explicit keys like `=0`.")}),pr.shift(),{type:e,arg:t,offset:n||0,cases:o}},O=function(t,r,e){return{type:"function",arg:t,key:r,param:e}},E=Vt("identifier"),z=/^[^\t-\r \x85\u200E\u200F\u2028\u2029!-\/:-@[-\^`{-~\xA1-\xA7\xA9\xAB\xAC\xAE\xB0\xB1\xB6\xBB\xBF\xD7\xF7\u2010-\u2027\u2030-\u203E\u2041-\u2053\u2055-\u205E\u2190-\u245F\u2500-\u2775\u2794-\u2BFF\u2E00-\u2E7F\u3001-\u3003\u3008-\u3020\u3030\uFD3E\uFD3F\uFE45\uFE46]/,P=Yt([["\t","\r"]," ","","‎","‏","\u2028","\u2029",["!","/"],[":","@"],["[","^"],"`",["{","~"],["¡","§"],"©","«","¬","®","°","±","¶","»","¿","×","÷",["‐","‧"],["‰","‾"],["⁁","⁓"],["⁕","⁞"],["←","⑟"],["─","❵"],["➔","⯿"],["⸀","⹿"],["、","〃"],["〈","〠"],"〰","﴾","﴿","﹅","﹆"],!0,!1),L=function(t,r){return{key:t,tokens:r}},J=function(t){return t},D=Vt("plural offset"),M="offset",_=It("offset",!1),T=":",R=It(":",!1),B=function(t){return t},q="=",$=It("=",!1),K="number",G=It("number",!1),U="date",Z=It("date",!1),I="time",Y=It("time",!1),V="spellout",W=It("spellout",!1),H="ordinal",Q=It("ordinal",!1),X="duration",tt=It("duration",!1),rt=function(t){if(r.strict||/^\d/.test(t))return!1;switch(t.toLowerCase()){case"select":case"plural":case"selectordinal":return!1;default:return!0}},et=function(t){return t},nt=function(t){return!r.strict},ot=function(t){return{tokens:t}},it=function(t){return{tokens:[t.join("")]}},ut=Vt("a valid (strict) function parameter"),at=/^[^'{}]/,ct=Yt(["'","{","}"],!0,!1),ht=function(t){return t.join("")},ft="'",st=It("'",!1),lt=function(t){return t},pt=function(t){return"{"+t.join("")+"}"},mt=Vt("doubled apostrophe"),dt="''",yt=It("''",!1),gt=function(){return"'"},vt=/^[^']/,wt=Yt(["'"],!0,!1),bt="'{",St=It("'{",!1),kt=function(t){return"{"+t.join("")},xt="'}",At=It("'}",!1),jt=function(t){return"}"+t.join("")},Nt=Vt("escaped string"),Ct="'#",Ft=It("'#",!1),Ot=function(t){return"#"+t.join("")},Et=function(t){return t[0]},zt=Vt("plain char"),Pt=/^[^{}#\0-\x08\x0E-\x1F\x7F]/,Lt=Yt(["{","}","#",["\0","\b"],["",""],""],!0,!1),Jt=function(t){return!pr[0]},Dt=function(t){return t},Mt=Vt("integer"),_t=/^[0-9]/,Tt=Yt([["0","9"]],!1,!1),Rt=Vt("white space"),Bt=/^[\t-\r \x85\u200E\u200F\u2028\u2029]/,qt=Yt([["\t","\r"]," ","","‎","‏","\u2028","\u2029"],!1,!1),$t=0,Kt=[{line:1,column:1}],Gt=0,Ut=[],Zt=0;if("startRule"in r){if(!(r.startRule in i))throw new Error("Can't start parsing from rule \""+r.startRule+'".');u=i[r.startRule]}function It(t,r){return{type:"literal",text:t,ignoreCase:r}}function Yt(t,r,e){return{type:"class",parts:t,inverted:r,ignoreCase:e}}function Vt(t){return{type:"other",description:t}}function Wt(r){var e,n=Kt[r];if(n)return n;for(e=r-1;!Kt[e];)e--;for(n={line:(n=Kt[e]).line,column:n.column};e<r;)10===t.charCodeAt(e)?(n.line++,n.column=1):n.column++,e++;return Kt[r]=n,n}function Ht(t,r){var e=Wt(t),n=Wt(r);return{start:{offset:t,line:e.line,column:e.column},end:{offset:r,line:n.line,column:n.column}}}function Qt(t){$t<Gt||($t>Gt&&(Gt=$t,Ut=[]),Ut.push(t))}function Xt(t,r,e){return new n(n.buildMessage(t,r),t,r,e)}function tr(){var t,r;for(t=[],r=rr();r!==o;)t.push(r),r=rr();return t}function rr(){var r,e,n;if((r=function(){var r,e,n,i;return r=$t,123===t.charCodeAt($t)?(e=l,$t++):(e=o,0===Zt&&Qt(p)),e!==o&&lr()!==o&&(n=er())!==o&&lr()!==o?(125===t.charCodeAt($t)?(i=m,$t++):(i=o,0===Zt&&Qt(d)),i!==o?(e=y(n),r=e):($t=r,r=o)):($t=r,r=o),r}())===o&&(r=function(){var r,e,n,i,u,a,c,h,f;if(r=$t,123===t.charCodeAt($t)?(e=l,$t++):(e=o,0===Zt&&Qt(p)),e!==o)if(lr()!==o)if((n=er())!==o)if(lr()!==o)if(44===t.charCodeAt($t)?(i=g,$t++):(i=o,0===Zt&&Qt(v)),i!==o)if(lr()!==o)if($t,t.substr($t,6)===w?(u=w,$t+=6):(u=o,0===Zt&&Qt(b)),u!==o&&(u=S(n,u)),u!==o)if((u=lr())!==o)if(44===t.charCodeAt($t)?(a=g,$t++):(a=o,0===Zt&&Qt(v)),a!==o)if(lr()!==o){if(c=[],(h=nr())!==o)for(;h!==o;)c.push(h),h=nr();else c=o;c!==o&&(h=lr())!==o?(125===t.charCodeAt($t)?(f=m,$t++):(f=o,0===Zt&&Qt(d)),f!==o?(e=k(n,c),r=e):($t=r,r=o)):($t=r,r=o)}else $t=r,r=o;else $t=r,r=o;else $t=r,r=o;else $t=r,r=o;else $t=r,r=o;else $t=r,r=o;else $t=r,r=o;else $t=r,r=o;else $t=r,r=o;else $t=r,r=o;return r}())===o&&(r=function(){var r,e,n,i,u,a,c,h,f,s,y;if(r=$t,123===t.charCodeAt($t)?(e=l,$t++):(e=o,0===Zt&&Qt(p)),e!==o)if(lr()!==o)if((n=er())!==o)if(lr()!==o)if(44===t.charCodeAt($t)?(i=g,$t++):(i=o,0===Zt&&Qt(v)),i!==o)if(lr()!==o)if(u=$t,t.substr($t,6)===x?(a=x,$t+=6):(a=o,0===Zt&&Qt(A)),a===o&&(t.substr($t,13)===j?(a=j,$t+=13):(a=o,0===Zt&&Qt(N))),a!==o&&(a=C(n,a)),(u=a)!==o)if((a=lr())!==o)if(44===t.charCodeAt($t)?(c=g,$t++):(c=o,0===Zt&&Qt(v)),c!==o)if(lr()!==o)if((h=function(){var r,e,n,i,u;return Zt++,r=$t,(e=lr())!==o?(t.substr($t,6)===M?(n=M,$t+=6):(n=o,0===Zt&&Qt(_)),n!==o&&lr()!==o?(58===t.charCodeAt($t)?(i=T,$t++):(i=o,0===Zt&&Qt(R)),i!==o&&lr()!==o&&(u=sr())!==o&&lr()!==o?(e=B(u),r=e):($t=r,r=o)):($t=r,r=o)):($t=r,r=o),Zt--,r===o&&(e=o,0===Zt&&Qt(D)),r}())===o&&(h=null),h!==o){if(f=[],(s=or())!==o)for(;s!==o;)f.push(s),s=or();else f=o;f!==o&&(s=lr())!==o?(125===t.charCodeAt($t)?(y=m,$t++):(y=o,0===Zt&&Qt(d)),y!==o?(e=F(n,u,h,f),r=e):($t=r,r=o)):($t=r,r=o)}else $t=r,r=o;else $t=r,r=o;else $t=r,r=o;else $t=r,r=o;else $t=r,r=o;else $t=r,r=o;else $t=r,r=o;else $t=r,r=o;else $t=r,r=o;else $t=r,r=o;else $t=r,r=o;return r}())===o&&(r=function(){var r,e,n,i,u,a,c;return r=$t,123===t.charCodeAt($t)?(e=l,$t++):(e=o,0===Zt&&Qt(p)),e!==o&&lr()!==o&&(n=er())!==o&&lr()!==o?(44===t.charCodeAt($t)?(i=g,$t++):(i=o,0===Zt&&Qt(v)),i!==o&&lr()!==o&&(u=function(){var r,e,n,i,u;return t.substr($t,6)===K?(r=K,$t+=6):(r=o,0===Zt&&Qt(G)),r===o&&(t.substr($t,4)===U?(r=U,$t+=4):(r=o,0===Zt&&Qt(Z)),r===o&&(t.substr($t,4)===I?(r=I,$t+=4):(r=o,0===Zt&&Qt(Y)),r===o&&(t.substr($t,8)===V?(r=V,$t+=8):(r=o,0===Zt&&Qt(W)),r===o&&(t.substr($t,7)===H?(r=H,$t+=7):(r=o,0===Zt&&Qt(Q)),r===o&&(t.substr($t,8)===X?(r=X,$t+=8):(r=o,0===Zt&&Qt(tt)),r===o&&(r=$t,e=$t,Zt++,t.substr($t,6)===w?(n=w,$t+=6):(n=o,0===Zt&&Qt(b)),Zt--,n===o?e=void 0:($t=e,e=o),e!==o?(n=$t,Zt++,t.substr($t,6)===x?(i=x,$t+=6):(i=o,0===Zt&&Qt(A)),Zt--,i===o?n=void 0:($t=n,n=o),n!==o?(i=$t,Zt++,t.substr($t,13)===j?(u=j,$t+=13):(u=o,0===Zt&&Qt(N)),Zt--,u===o?i=void 0:($t=i,i=o),i!==o&&(u=er())!==o&&(rt(u)?void 0:o)!==o?(e=et(u),r=e):($t=r,r=o)):($t=r,r=o)):($t=r,r=o))))))),r}())!==o&&lr()!==o?((a=function(){var r,e,n,i,u;if(r=$t,(e=lr())!==o)if(44===t.charCodeAt($t)?(n=g,$t++):(n=o,0===Zt&&Qt(v)),n!==o){for(i=[],u=rr();u!==o;)i.push(u),u=rr();i!==o&&(u=(u=nt(i))?void 0:o)!==o?(e=ot(i),r=e):($t=r,r=o)}else $t=r,r=o;else $t=r,r=o;if(r===o)if(r=$t,(e=lr())!==o)if(44===t.charCodeAt($t)?(n=g,$t++):(n=o,0===Zt&&Qt(v)),n!==o){for(i=[],u=ur();u!==o;)i.push(u),u=ur();i!==o?(e=it(i),r=e):($t=r,r=o)}else $t=r,r=o;else $t=r,r=o;return r}())===o&&(a=null),a!==o?(125===t.charCodeAt($t)?(c=m,$t++):(c=o,0===Zt&&Qt(d)),c!==o?(e=O(n,u,a),r=e):($t=r,r=o)):($t=r,r=o)):($t=r,r=o)):($t=r,r=o),r}())===o&&(r=$t,35===t.charCodeAt($t)?(e=a,$t++):(e=o,0===Zt&&Qt(c)),e!==o&&(n=(n=h())?void 0:o)!==o?r=e=f():($t=r,r=o),r===o)){if(r=$t,e=[],(n=fr())!==o)for(;n!==o;)e.push(n),n=fr();else e=o;e!==o&&(e=s(e)),r=e}return r}function er(){var r,e,n;if(Zt++,r=$t,e=[],z.test(t.charAt($t))?(n=t.charAt($t),$t++):(n=o,0===Zt&&Qt(P)),n!==o)for(;n!==o;)e.push(n),z.test(t.charAt($t))?(n=t.charAt($t),$t++):(n=o,0===Zt&&Qt(P));else e=o;return r=e!==o?t.substring(r,$t):e,Zt--,r===o&&(e=o,0===Zt&&Qt(E)),r}function nr(){var t,r,e;return t=$t,lr()!==o&&(r=er())!==o&&lr()!==o&&(e=ir())!==o?t=L(r,e):($t=t,t=o),t}function or(){var r,e,n;return r=$t,lr()!==o&&(e=function(){var r,e,n;return(r=er())===o&&(r=$t,61===t.charCodeAt($t)?(e=q,$t++):(e=o,0===Zt&&Qt($)),e!==o&&(n=sr())!==o?(e=B(n),r=e):($t=r,r=o)),r}())!==o&&lr()!==o&&(n=ir())!==o?r=L(e,n):($t=r,r=o),r}function ir(){var r,e,n,i,u,a;if(r=$t,123===t.charCodeAt($t)?(e=l,$t++):(e=o,0===Zt&&Qt(p)),e!==o)if(n=$t,(i=lr())!==o?(u=$t,Zt++,123===t.charCodeAt($t)?(a=l,$t++):(a=o,0===Zt&&Qt(p)),Zt--,a!==o?($t=u,u=void 0):u=o,u!==o?n=i=[i,u]:($t=n,n=o)):($t=n,n=o),n===o&&(n=null),n!==o){for(i=[],u=rr();u!==o;)i.push(u),u=rr();i!==o&&(u=lr())!==o?(125===t.charCodeAt($t)?(a=m,$t++):(a=o,0===Zt&&Qt(d)),a!==o?r=e=J(i):($t=r,r=o)):($t=r,r=o)}else $t=r,r=o;else $t=r,r=o;return r}function ur(){var r,e,n,i;if(Zt++,r=$t,e=[],at.test(t.charAt($t))?(n=t.charAt($t),$t++):(n=o,0===Zt&&Qt(ct)),n!==o)for(;n!==o;)e.push(n),at.test(t.charAt($t))?(n=t.charAt($t),$t++):(n=o,0===Zt&&Qt(ct));else e=o;if(e!==o&&(e=ht(e)),(r=e)===o&&(r=ar())===o&&(r=$t,39===t.charCodeAt($t)?(e=ft,$t++):(e=o,0===Zt&&Qt(st)),e!==o&&(n=cr())!==o?(39===t.charCodeAt($t)?(i=ft,$t++):(i=o,0===Zt&&Qt(st)),i!==o?r=e=lt(n):($t=r,r=o)):($t=r,r=o),r===o))if(r=$t,123===t.charCodeAt($t)?(e=l,$t++):(e=o,0===Zt&&Qt(p)),e!==o){for(n=[],i=ur();i!==o;)n.push(i),i=ur();n!==o?(125===t.charCodeAt($t)?(i=m,$t++):(i=o,0===Zt&&Qt(d)),i!==o?r=e=pt(n):($t=r,r=o)):($t=r,r=o)}else $t=r,r=o;return Zt--,r===o&&(e=o,0===Zt&&Qt(ut)),r}function ar(){var r,e;return Zt++,r=$t,t.substr($t,2)===dt?(e=dt,$t+=2):(e=o,0===Zt&&Qt(yt)),e!==o&&(e=gt()),Zt--,(r=e)===o&&(e=o,0===Zt&&Qt(mt)),r}function cr(){var r,e,n;if((r=ar())===o){if(r=$t,e=[],vt.test(t.charAt($t))?(n=t.charAt($t),$t++):(n=o,0===Zt&&Qt(wt)),n!==o)for(;n!==o;)e.push(n),vt.test(t.charAt($t))?(n=t.charAt($t),$t++):(n=o,0===Zt&&Qt(wt));else e=o;e!==o&&(e=s(e)),r=e}return r}function hr(){var r,e,n,i,u,a;if(Zt++,(r=function(){var r,e,n,i;if(r=$t,t.substr($t,2)===bt?(e=bt,$t+=2):(e=o,0===Zt&&Qt(St)),e!==o){for(n=[],i=cr();i!==o;)n.push(i),i=cr();n!==o?(39===t.charCodeAt($t)?(i=ft,$t++):(i=o,0===Zt&&Qt(st)),i!==o?r=e=kt(n):($t=r,r=o)):($t=r,r=o)}else $t=r,r=o;if(r===o)if(r=$t,t.substr($t,2)===xt?(e=xt,$t+=2):(e=o,0===Zt&&Qt(At)),e!==o){for(n=[],i=cr();i!==o;)n.push(i),i=cr();n!==o?(39===t.charCodeAt($t)?(i=ft,$t++):(i=o,0===Zt&&Qt(st)),i!==o?r=e=jt(n):($t=r,r=o)):($t=r,r=o)}else $t=r,r=o;return r}())===o){if(r=$t,e=$t,n=$t,t.substr($t,2)===Ct?(i=Ct,$t+=2):(i=o,0===Zt&&Qt(Ft)),i!==o){for(u=[],a=cr();a!==o;)u.push(a),a=cr();u!==o?(39===t.charCodeAt($t)?(a=ft,$t++):(a=o,0===Zt&&Qt(st)),a!==o?n=i=Ot(u):($t=n,n=o)):($t=n,n=o)}else $t=n,n=o;n!==o&&(i=(i=h())?void 0:o)!==o?e=n=[n,i]:($t=e,e=o),e!==o&&(e=Et(e)),(r=e)===o&&(39===t.charCodeAt($t)?(r=ft,$t++):(r=o,0===Zt&&Qt(st)))}return Zt--,r===o&&(e=o,0===Zt&&Qt(Nt)),r}function fr(){var r,e;return(r=ar())===o&&(r=hr())===o&&(r=$t,35===t.charCodeAt($t)?(e=a,$t++):(e=o,0===Zt&&Qt(c)),e!==o&&(Jt(e)?void 0:o)!==o?r=e=Dt(e):($t=r,r=o),r===o&&(r=function(){var r;return Zt++,Pt.test(t.charAt($t))?(r=t.charAt($t),$t++):(r=o,0===Zt&&Qt(Lt)),Zt--,r===o&&0===Zt&&Qt(zt),r}())),r}function sr(){var r,e,n;if(Zt++,r=$t,e=[],_t.test(t.charAt($t))?(n=t.charAt($t),$t++):(n=o,0===Zt&&Qt(Tt)),n!==o)for(;n!==o;)e.push(n),_t.test(t.charAt($t))?(n=t.charAt($t),$t++):(n=o,0===Zt&&Qt(Tt));else e=o;return r=e!==o?t.substring(r,$t):e,Zt--,r===o&&(e=o,0===Zt&&Qt(Mt)),r}function lr(){var r,e,n;for(Zt++,r=$t,e=[],Bt.test(t.charAt($t))?(n=t.charAt($t),$t++):(n=o,0===Zt&&Qt(qt));n!==o;)e.push(n),Bt.test(t.charAt($t))?(n=t.charAt($t),$t++):(n=o,0===Zt&&Qt(qt));return r=e!==o?t.substring(r,$t):e,Zt--,r===o&&(e=o,0===Zt&&Qt(Rt)),r}var pr=[!1];if((e=u())!==o&&$t===t.length)return e;throw e!==o&&$t<t.length&&Qt({type:"end"}),Xt(Ut,Gt<t.length?t.charAt(Gt):null,Gt<t.length?Ht(Gt,Gt+1):Ht(Gt,Gt))}}},function(t,r,e){var n,o,i=[{cardinal:["other"],ordinal:["other"]},{cardinal:["one","other"],ordinal:["other"]},{cardinal:["one","other"],ordinal:["one","other"]},{cardinal:["one","two","other"],ordinal:["other"]}];void 0===(o="function"==typeof(n={af:i[1],ak:i[1],am:i[1],ar:{cardinal:["zero","one","two","few","many","other"],ordinal:["other"]},ars:{cardinal:["zero","one","two","few","many","other"],ordinal:["other"]},as:{cardinal:["one","other"],ordinal:["one","two","few","many","other"]},asa:i[1],ast:i[1],az:{cardinal:["one","other"],ordinal:["one","few","many","other"]},be:{cardinal:["one","few","many","other"],ordinal:["few","other"]},bem:i[1],bez:i[1],bg:i[1],bh:i[1],bm:i[0],bn:{cardinal:["one","other"],ordinal:["one","two","few","many","other"]},bo:i[0],br:{cardinal:["one","two","few","many","other"],ordinal:["other"]},brx:i[1],bs:{cardinal:["one","few","other"],ordinal:["other"]},ca:{cardinal:["one","other"],ordinal:["one","two","few","other"]},ce:i[1],cgg:i[1],chr:i[1],ckb:i[1],cs:{cardinal:["one","few","many","other"],ordinal:["other"]},cy:{cardinal:["zero","one","two","few","many","other"],ordinal:["zero","one","two","few","many","other"]},da:i[1],de:i[1],dsb:{cardinal:["one","two","few","other"],ordinal:["other"]},dv:i[1],dz:i[0],ee:i[1],el:i[1],en:{cardinal:["one","other"],ordinal:["one","two","few","other"]},eo:i[1],es:i[1],et:i[1],eu:i[1],fa:i[1],ff:i[1],fi:i[1],fil:i[2],fo:i[1],fr:i[2],fur:i[1],fy:i[1],ga:{cardinal:["one","two","few","many","other"],ordinal:["one","other"]},gd:{cardinal:["one","two","few","other"],ordinal:["one","two","few","other"]},gl:i[1],gsw:i[1],gu:{cardinal:["one","other"],ordinal:["one","two","few","many","other"]},guw:i[1],gv:{cardinal:["one","two","few","many","other"],ordinal:["other"]},ha:i[1],haw:i[1],he:{cardinal:["one","two","many","other"],ordinal:["other"]},hi:{cardinal:["one","other"],ordinal:["one","two","few","many","other"]},hr:{cardinal:["one","few","other"],ordinal:["other"]},hsb:{cardinal:["one","two","few","other"],ordinal:["other"]},hu:i[2],hy:i[2],ia:i[1],id:i[0],ig:i[0],ii:i[0],in:i[0],io:i[1],is:i[1],it:{cardinal:["one","other"],ordinal:["many","other"]},iu:i[3],iw:{cardinal:["one","two","many","other"],ordinal:["other"]},ja:i[0],jbo:i[0],jgo:i[1],ji:i[1],jmc:i[1],jv:i[0],jw:i[0],ka:{cardinal:["one","other"],ordinal:["one","many","other"]},kab:i[1],kaj:i[1],kcg:i[1],kde:i[0],kea:i[0],kk:{cardinal:["one","other"],ordinal:["many","other"]},kkj:i[1],kl:i[1],km:i[0],kn:i[1],ko:i[0],ks:i[1],ksb:i[1],ksh:{cardinal:["zero","one","other"],ordinal:["other"]},ku:i[1],kw:i[3],ky:i[1],lag:{cardinal:["zero","one","other"],ordinal:["other"]},lb:i[1],lg:i[1],lkt:i[0],ln:i[1],lo:{cardinal:["other"],ordinal:["one","other"]},lt:{cardinal:["one","few","many","other"],ordinal:["other"]},lv:{cardinal:["zero","one","other"],ordinal:["other"]},mas:i[1],mg:i[1],mgo:i[1],mk:{cardinal:["one","other"],ordinal:["one","two","many","other"]},ml:i[1],mn:i[1],mo:{cardinal:["one","few","other"],ordinal:["one","other"]},mr:{cardinal:["one","other"],ordinal:["one","two","few","other"]},ms:{cardinal:["other"],ordinal:["one","other"]},mt:{cardinal:["one","few","many","other"],ordinal:["other"]},my:i[0],nah:i[1],naq:i[3],nb:i[1],nd:i[1],ne:i[2],nl:i[1],nn:i[1],nnh:i[1],no:i[1],nqo:i[0],nr:i[1],nso:i[1],ny:i[1],nyn:i[1],om:i[1],or:{cardinal:["one","other"],ordinal:["one","two","few","many","other"]},os:i[1],pa:i[1],pap:i[1],pl:{cardinal:["one","few","many","other"],ordinal:["other"]},prg:{cardinal:["zero","one","other"],ordinal:["other"]},ps:i[1],pt:i[1],"pt-PT":i[1],rm:i[1],ro:{cardinal:["one","few","other"],ordinal:["one","other"]},rof:i[1],root:i[0],ru:{cardinal:["one","few","many","other"],ordinal:["other"]},rwk:i[1],sah:i[0],saq:i[1],sc:{cardinal:["one","other"],ordinal:["many","other"]},scn:{cardinal:["one","other"],ordinal:["many","other"]},sd:i[1],sdh:i[1],se:i[3],seh:i[1],ses:i[0],sg:i[0],sh:{cardinal:["one","few","other"],ordinal:["other"]},shi:{cardinal:["one","few","other"],ordinal:["other"]},si:i[1],sk:{cardinal:["one","few","many","other"],ordinal:["other"]},sl:{cardinal:["one","two","few","other"],ordinal:["other"]},sma:i[3],smi:i[3],smj:i[3],smn:i[3],sms:i[3],sn:i[1],so:i[1],sq:{cardinal:["one","other"],ordinal:["one","many","other"]},sr:{cardinal:["one","few","other"],ordinal:["other"]},ss:i[1],ssy:i[1],st:i[1],sv:i[2],sw:i[1],syr:i[1],ta:i[1],te:i[1],teo:i[1],th:i[0],ti:i[1],tig:i[1],tk:{cardinal:["one","other"],ordinal:["few","other"]},tl:i[2],tn:i[1],to:i[0],tr:i[1],ts:i[1],tzm:i[1],ug:i[1],uk:{cardinal:["one","few","many","other"],ordinal:["few","other"]},ur:i[1],uz:i[1],ve:i[1],vi:{cardinal:["other"],ordinal:["one","other"]},vo:i[1],vun:i[1],wa:i[1],wae:i[1],wo:i[0],xh:i[1],xog:i[1],yi:i[1],yo:i[0],yue:i[0],zh:i[0],zu:i[1]})?n.call(r,e,r,t):n)||(t.exports=o)},function(t,r){function e(t,r,e){var n={day:"numeric",month:"short",year:"numeric"};switch(e){case"full":n.weekday="long";case"long":n.month="long";break;case"short":n.month="numeric"}return new Date(t).toLocaleDateString(r,n)}t.exports=function(){return e}},function(t,r){function e(t){if(!isFinite(t))return String(t);var r="";t<0?(r="-",t=Math.abs(t)):t=Number(t);var e=t%60,n=[Math.round(e)===e?e:e.toFixed(3)];return t<60?n.unshift(0):(t=Math.round((t-n[0])/60),n.unshift(t%60),t>=60&&(t=Math.round((t-n[0])/60),n.unshift(t))),r+n.shift()+":"+n.map(function(t){return t<10?"0"+String(t):String(t)}).join(":")}t.exports=function(){return e}},function(t,r){t.exports=function(t){var r=function(t,r,e){var n=e&&e.split(":")||[],o={integer:{maximumFractionDigits:0},percent:{style:"percent"},currency:{style:"currency",currency:n[1]&&n[1].trim()||CURRENCY,minimumFractionDigits:2,maximumFractionDigits:2}};return new Intl.NumberFormat(r,o[n[0]]||{}).format(t)}.toString().replace("CURRENCY",JSON.stringify(t.currency||"USD")).match(/\(([^)]*)\)[^{]*{([\s\S]*)}/);return new Function(r[1],r[2])}},function(t,r){function e(t,r,e){var n={second:"numeric",minute:"numeric",hour:"numeric"};switch(e){case"full":case"long":n.timeZoneName="short";break;case"short":delete n.second}return new Date(t).toLocaleTimeString(r,n)}t.exports=function(){return e}},function(t,r,e){"use strict";e.r(r);var n=e(1),o=e.n(n),i=e(2),u={break:!0,continue:!0,delete:!0,else:!0,for:!0,function:!0,if:!0,in:!0,new:!0,return:!0,this:!0,typeof:!0,var:!0,void:!0,while:!0,with:!0,case:!0,catch:!0,default:!0,do:!0,finally:!0,instanceof:!0,switch:!0,throw:!0,try:!0},a={debugger:!0,class:!0,enum:!0,extends:!0,super:!0,const:!0,export:!0,import:!0,null:!0,true:!0,false:!0,implements:!0,let:!0,private:!0,public:!0,yield:!0,interface:!0,package:!0,protected:!0,static:!0};function c(t,r){if(/^[A-Z_$][0-9A-Z_$]*$/i.test(t)&&!u[t])return r?"".concat(r,".").concat(t):t;var e=JSON.stringify(t);return r?r+"[".concat(e,"]"):e}function h(t){var r=t.trim().replace(/\W+/g,"_");return u[r]||a[r]||/^\d/.test(r)?"_"+r:r}var f=new RegExp("^"+["ar","ckb","fa","he","ks($|[^bfh])","lrc","mzn","pa-Arab","ps","ug","ur","uz-Arab","yi"].join("|^"));function s(t){return(s="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}function l(t,r){for(var e=0;e<r.length;e++){var n=r[e];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}var p=function(){function t(r){!function(t,r){if(!(t instanceof r))throw new TypeError("Cannot call a class as a function")}(this,t),this.mf=r,this.lc=null,this.locales={},this.runtime={},this.formatters={}}var r,e,n;return r=t,(e=[{key:"compile",value:function(t,r,e){var n=this;if("object"!=s(t)){this.lc=r;var o=e[r]||{cardinal:[],ordinal:[]};o.strict=!!this.mf.options.strictNumberSign;var u=Object(i.parse)(t,o).map(function(t){return n.token(t)});return"function(d) { return ".concat(u.join(" + ")||'""',"; }")}var a={};for(var c in t){var h=e.hasOwnProperty(c)?c:r;a[c]=this.compile(t[c],h,e)}return a}},{key:"cases",value:function(t,r){var e=this,n="select"===t.type||!this.mf.hasCustomPluralFuncs,o=t.cases.map(function(t){var o=t.key,i=t.tokens;"other"===o&&(n=!1);var u=i.map(function(t){return e.token(t,r)});return c(o)+": "+(u.join(" + ")||'""')});if(n)throw new Error("No 'other' form found in "+JSON.stringify(t));return"{ ".concat(o.join(", ")," }")}},{key:"token",value:function(t,r){var e,n=this;if("string"==typeof t)return JSON.stringify(t);var o,i,u,a,s=[c(t.arg,"d")];switch(t.type){case"argument":return this.mf.options.biDiSupport?(o=s[0],i=this.lc,u=f.test(i),a=JSON.stringify(u?"‏":"‎"),"".concat(a," + ").concat(o," + ").concat(a)):s[0];case"select":e="select",r&&this.mf.options.strictNumberSign&&(r=null),s.push(this.cases(t,r)),this.runtime.select=!0;break;case"selectordinal":e="plural",s.push(0,h(this.lc),this.cases(t,t),1),this.locales[this.lc]=!0,this.runtime.plural=!0;break;case"plural":e="plural",s.push(t.offset||0,h(this.lc),this.cases(t,t)),this.locales[this.lc]=!0,this.runtime.plural=!0;break;case"function":if(!(t.key in this.mf.fmt)&&t.key in this.mf.constructor.formatters){var l=this.mf.constructor.formatters[t.key];this.mf.fmt[t.key]=l(this.mf)}if(!this.mf.fmt[t.key])throw new Error("Formatting function ".concat(JSON.stringify(t.key)," not found!"));if(s.push(JSON.stringify(this.lc)),t.param){r&&this.mf.options.strictNumberSign&&(r=null);var p=t.param.tokens.map(function(t){return n.token(t,r)});s.push("("+(p.join(" + ")||'""')+").trim()")}e=c(t.key,"fmt"),this.formatters[t.key]=!0;break;case"octothorpe":if(!r)return'"#"';e="number",s=[c(r.arg,"d"),JSON.stringify(r.arg)],r.offset&&s.push(r.offset),this.runtime.number=!0}if(!e)throw new Error("Parser error for token "+JSON.stringify(t));return"".concat(e,"(").concat(s.join(", "),")")}}])&&l(r.prototype,e),n&&l(r,n),t}(),m=e(3),d=e.n(m),y=e(0),g=e.n(y);function v(t,r,e){var n=function(){return r.apply(this,arguments)};if(n.toString=function(){return r.toString()},e){var o=d.a[t]||{};n.cardinal=o.cardinal,n.ordinal=o.ordinal}else n.cardinal=[],n.ordinal=[];return n}function w(t,r){for(var e=r.pluralKeyChecks,n=String(t);n;n=n.replace(/[-_]?[^-_]*$/,"")){var o=g.a[n];if(o)return v(n,o,e)}throw new Error("Localisation function not found for locale "+JSON.stringify(t))}function b(t){return(b="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}function S(t,r){for(var e=0;e<r.length;e++){var n=r[e];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}var k=function(){function t(r){!function(t,r){if(!(t instanceof r))throw new TypeError("Cannot call a class as a function")}(this,t),this.plural=function(t,r,e,n,o){if({}.hasOwnProperty.call(n,t))return n[t];r&&(t-=r);var i=e(t,o);return i in n?n[i]:n.other},this.select=function(t,r){return{}.hasOwnProperty.call(r,t)?r[t]:r.other},this.mf=r,this.setStrictNumber(r.options.strictNumberSign)}var r,e,n;return r=t,(e=[{key:"setStrictNumber",value:function(r){this.number=r?t.strictNumber:t.defaultNumber}},{key:"toString",value:function(t,r){for(var e={},n=Object.keys(r.locales),o=0;o<n.length;++o){var i=n[o];e[h(i)]=t[i]}for(var u=Object.keys(r.runtime),a=0;a<u.length;++a){var f=u[a];e[f]=this[f]}var s=Object.keys(r.formatters);if(s.length>0){e.fmt={};for(var l=0;l<s.length;++l){var p=s[l];e.fmt[p]=this.mf.fmt[p]}}return function t(r,e){if("object"!=b(r)){var n=r.toString().replace(/^(function )\w*/,"$1"),o=/([ \t]*)\S.*$/.exec(n);return o?n.replace(new RegExp("^"+o[1],"mg"),""):n}var i=[];for(var u in r){var a=t(r[u],e+1);i.push(0===e?"var ".concat(u," = ").concat(a,";\n"):"".concat(c(u),": ").concat(a))}if(0===e)return i.join("");if(0===i.length)return"{}";for(var h="  ";--e;)h+="  ";var f=i.join(",\n").replace(/^/gm,h);return"{\n".concat(f,"\n}")}(e,0)}}])&&S(r.prototype,e),n&&S(r,n),t}();function x(t){return(x="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}function A(t,r){for(var e=0;e<r.length;e++){var n=r[e];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}function j(t,r,e){return r&&A(t.prototype,r),e&&A(t,e),t}k.defaultNumber=function(t,r,e){if(!e)return t;if(isNaN(t))throw new Error("Can't apply offset:"+e+" to argument `"+r+"` with non-numerical value "+JSON.stringify(t)+".");return t-e},k.strictNumber=function(t,r,e){if(isNaN(t))throw new Error("Argument `"+r+"` has non-numerical value "+JSON.stringify(t)+".");return t-(e||0)},e.d(r,"default",function(){return N});var N=function(){function t(r,e){var n=this;if(function(t,r){if(!(t instanceof r))throw new TypeError("Cannot call a class as a function")}(this,t),this.options=Object.assign({biDiSupport:!1,customFormatters:null,pluralKeyChecks:!0,strictNumberSign:!1},e),this.pluralFuncs={},"string"==typeof r)this.pluralFuncs[r]=w(r,this.options),this.defaultLocale=r;else if(Array.isArray(r))r.forEach(function(t){n.pluralFuncs[t]=w(t,n.options)}),this.defaultLocale=r[0];else{if(r)for(var o=Object.keys(r),i=0;i<o.length;++i){var u=o[i];if("function"!=typeof r[u]){var a="Expected function value for locale "+String(u);throw new Error(a)}this.pluralFuncs[u]=r[u],this.defaultLocale||(this.defaultLocale=u)}this.defaultLocale?this.hasCustomPluralFuncs=!0:(this.defaultLocale=t.defaultLocale,this.hasCustomPluralFuncs=!1)}this.fmt=Object.assign({},this.options.customFormatters),this.runtime=new k(this)}return j(t,null,[{key:"escape",value:function(t,r){var e=r?/[#{}]/g:/[{}]/g;return String(t).replace(e,"'$&'")}}]),j(t,[{key:"addFormatters",value:function(t){for(var r=Object.keys(t),e=0;e<r.length;++e){var n=r[e];this.fmt[n]=t[n]}return this}},{key:"disablePluralKeyChecks",value:function(){for(var t in this.options.pluralKeyChecks=!1,this.pluralFuncs){var r=this.pluralFuncs[t];r&&(r.cardinal=[],r.ordinal=[])}return this}},{key:"setBiDiSupport",value:function(t){return this.options.biDiSupport=!!t||void 0===t,this}},{key:"setStrictNumberSign",value:function(t){return this.options.strictNumberSign=!!t||void 0===t,this.runtime.setStrictNumber(this.options.strictNumberSign),this}},{key:"compile",value:function(t,r){var e={};if(0===Object.keys(this.pluralFuncs).length)if(r){var n=w(r,this.options);if(!n){var o=JSON.stringify(r);throw new Error("Locale ".concat(o," not found!"))}e[r]=n}else r=this.defaultLocale,e=function(t){for(var r=t.pluralKeyChecks,e={},n=Object.keys(g.a),o=0;o<n.length;++o){var i=n[o];e[i]=v(i,g.a[i],r)}return e}(this.options);else if(r){var i=this.pluralFuncs[r];if(!i){var u=JSON.stringify(r),a=JSON.stringify(this.pluralFuncs);throw new Error("Locale ".concat(u," not found in ").concat(a,"!"))}e[r]=i}else r=this.defaultLocale,e=this.pluralFuncs;var f=new p(this),s=f.compile(t,r,e);if("object"!=x(t)){var l=new Function("number, plural, select, fmt",h(r),"return "+s),m=this.runtime;return l(m.number,m.plural,m.select,this.fmt,e[r])}var d=this.runtime.toString(e,f)+"\n",y=function t(r,e){if(e||(e=0),"object"!=x(r))return r;for(var n="",o=0;o<e;++o)n+="  ";var i=[];for(var u in r){var a=t(r[u],e+1);i.push("\n".concat(n,"  ").concat(c(u),": ").concat(a))}return"{".concat(i.join(","),"\n").concat(n,"}")}(s),b=new Function(d+"return "+y)();if(b.hasOwnProperty("toString"))throw new Error("The top-level message key `toString` is reserved");return b.toString=function(t){return t&&"export default"!==t?t.indexOf(".")>-1?d+t+" = "+y:d+["(function (root, G) {",'  if (typeof define === "function" && define.amd) { define(G); }','  else if (typeof exports === "object") { module.exports = G; }',"  else { "+c(t,"root")+" = G; }","})(this, "+y+");"].join("\n"):d+"export default "+y},b}}]),t}();N.defaultLocale="en",N.formatters=o.a}]).default});

},{}],99:[function(_dereq_,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[68])(68)
});

/* ES6 module suppoort */
export const zpt = global_zpt;
