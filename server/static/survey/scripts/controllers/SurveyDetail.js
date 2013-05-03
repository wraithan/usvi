'use strict';

var map = {
    center: {
        lat: 47,
        lng: -124
    },
    zoom: 7,
    marker: {
        visibility: true,
        lat: 47,
        lng: -124

    },
    msg: null
}

var answers = {};

angular.module('askApp')
    .controller('SurveyDetailCtrl', function($scope, $routeParams, $http, $location, $dialog, $interpolate, $timeout, offlineSurvey) {

    $http.get('/api/v1/survey/' + $routeParams.surveySlug + '/?format=json').success(function(data) {
        $scope.survey = data;

        // we may inject a question into the scope
        if (!$scope.question) {
            $scope.question = _.find($scope.survey.questions, function(question) {
                return question.slug === $routeParams.questionSlug;
            });

        }
        if ($scope.question && $scope.question.title) {
            $scope.question.displayTitle = $interpolate($scope.question.title)($scope);
        }

        if ($scope.question && $scope.question.type === 'info') {
            $scope.infoView = '/static/survey/survey-pages/' + $routeParams.surveySlug + '/' + $scope.question.info + '.html';

        }

        $scope.nextQuestionPath = $scope.getNextQuestionPath();

        // Fill options list.
        if ($scope.question && $scope.question.options_json && $scope.question.options_json.length > 0 && !$scope.question.options_from_previous_answer) {
            // Using the provided json file to set options.
            $http.get($scope.question.options_json).success(function(data) {
                var groups = _.groupBy(data, function(item) {
                    return item.group;
                })
                if ($scope.question.randomize_groups) {
                    $scope.question.options = _.flatten(_.shuffle(_.toArray(groups)))
                } else {
                    $scope.question.options = data;
                }
                $scope.otherOption = {
                    'checked': false
                }
                $scope.otherAnswer = null;
            });

        } else if ($scope.question && $scope.question.options_from_previous_answer && $scope.question.slug == 'county') {
            // County question is dependent on state answer to retrieve a 
            // json file of counties for the selected state.
            var stateAnswer = $scope.getAnswer($scope.question.options_from_previous_answer),
                stateAbrv = stateAnswer.label || "NO_STATE";
            $http.get('/static/survey/surveys/counties/' + stateAbrv + '.json').success(function(data, status, headers, config) {
                if (Object.prototype.toString.call(data) === '[object Array]' && data.length > 0) {
                    $scope.question.options = data;
                } else {
                    $scope.question.options = [{
                        label: "NO_COUNTY",
                        text: "No counties found. Please select this option and continue."
                    }];
                }
            }).error(function(data, status, headers, config) {
                $scope.question.options = [{
                    label: "NO_COUNTY",
                    text: "No counties found. Please select this option and continue."
                }];
            });

        } else if ($scope.question && $scope.question.options_from_previous_answer) {
            $scope.question.options = $scope.getAnswer($scope.question.options_from_previous_answer);
            _.each($scope.question.options, function(item) {
                item.checked = false;
            });
        };

        // penny question controller
        if ($scope.question && $scope.question.type === 'pennies') {
            $scope.map = map;
            if ($scope.getAnswer($scope.question.options_from_previous_answer)) {
                $scope.locations = JSON.parse($scope.getAnswer($scope.question.options_from_previous_answer));
            }

            $scope.question.total = 100;

            _.each($scope.locations, function(location) {
                location.pennies = null;
                $scope.$watch(function() {
                    return location.pennies
                },

                function(newValue) {
                    var timer;
                    if (newValue) {
                        if (timer) {
                            timer.cancel();
                        } else {
                            timer = $timeout(function() {
                                var total = _.pluck($scope.locations, 'pennies');
                                var sum = _.reduce(total, function(memo, num) {
                                    return parseInt(memo, 10) + parseInt(num ? num : 0, 10);
                                }, 0);
                                $scope.question.total = 100 - sum;
                            }, 300);
                        }

                    }

                });
            });
        }
        // map 
        if ($scope.question && $scope.question.type === 'map-multipoint') {
            $scope.map = map;
            $scope.locations = [];
            $scope.activeMarker = false;
        }

        // grid question controller
        if ($scope.question && $scope.question.type === 'grid') {
            // Prep row initial row data, each row containing values.
            // for activityLabel, activityText, cost and numPeople.
            $scope.question.options = $scope.getAnswer($scope.question.options_from_previous_answer);
            _.each($scope.question.options, function (value, key, list) {
                list[key] = { 
                    activitySlug: value.label,
                    activityText: value.text,
                    cost: undefined,
                    numPeople: undefined };
            });

            // todo: Fill columns with persisted data if available.
            
            // Hard coding values for now.
            // $scope.question.options = [
            //     {activitySlug: 'camping', activityText: 'Camping', cost: undefined, numPeople: undefined},
            //     {activitySlug: 'eating', activityText: 'Eating', cost: undefined, numPeople: undefined},
            //     {activitySlug: 'surfing', activityText: 'Surfing', cost: undefined, numPeople: undefined}
            // ];

            // Configure grid.
            var gridCellTemplateDefault = '<div class="ngCellText" ng-class="col.colIndex()"><span ng-cell-text>{{COL_FIELD CUSTOM_FILTERS}}</span></div>';
            var costCellTemplate = '<input class="colt{{$index}} input-block-level" ng-model="row.entity[col.field]" style="height: 100%;" type="number" min="0" max="10000" value="{{row.getProperty(col.field)}}" ui-event="{ keypress : \'onlyDigits($event)\' }" required/>';
            var numPeopleCellTemplate = '<input class="colt{{$index}} input-block-level" ng-model="row.entity[col.field]" style="height: 100%;" type="number" min="0" max="1000" value="{{row.getProperty(col.field)}}" ui-event="{ keypress : \'onlyDigits($event)\' }" required/>';
            $scope.gridOptions = {
                data: 'question.options',
                enableSorting: false,
                enableCellSelection: true,
                canSelectRows: false,
                multiSelect: false,
                rowHeight: 50,
                plugins: [new ngGridFlexibleHeightPlugin()],
                rowTemplate: '<div ng-style="{\'z-index\': col.zIndex() }" ng-repeat="col in renderedColumns" ng-class="col.colIndex()" class="ngCell {{col.cellClass}}" ng-cell></div>',
                columnDefs: [
                    {field: 'activityText', displayName: 'Expense Item'},
                    {field:'cost', displayName:'Cost ($0 - $10,000)', cellTemplate: costCellTemplate },
                    {field:'numPeople', displayName:'# of People Covered', cellTemplate: numPeopleCellTemplate }]
            };
        }
    });

    $scope.isAuthenticated = isAuthenticated;

    // landing page view
    $scope.landingView = '/static/survey/survey-pages/' + $routeParams.surveySlug + '/landing.html';


    $scope.getAnswer = function(questionSlug) {

        if (answers[questionSlug]) {
            return answers[questionSlug]
        } else {
            return "unknown";
        }
    };

    $scope.addMarker = function() {
        $scope.activeMarker = {
            lat: $scope.map.center.lat,
            lng: $scope.map.center.lng
        };

        $scope.locations.push($scope.activeMarker);
    }

    $scope.addLocation = function(location) {
        // var locations = _.without($scope.locations, $scope.activeMarker);
        $scope.locations[_.indexOf($scope.locations, $scope.activeMarker)] = location;
        // $scope.locations = locations;
        // $scope.locations.push(location);
        $scope.activeMarker = false;
    };

    $scope.confirmLocation = function() {
        $scope.dialog = $dialog.dialog({
            backdrop: true,
            keyboard: true,
            backdropClick: false,
            templateUrl: '/static/survey/views/locationActivitiesModal.html',
            controller: 'SurveyDetailCtrl',
            scope: {
                question: $scope.question.modalQuestion
            },
            success: function(question, answer) {
                $scope.addLocation({
                    lat: $scope.map.marker.lat,
                    lng: $scope.map.marker.lng,
                    question: question,
                    answers: answer
                });
                $scope.dialog.close();
                $scope.dialog = null;
            },
            error: function(arg1, arg2) {
                debugger;
            }
        });
        $scope.dialog.options.scope.dialog = $scope.dialog;
        $scope.dialog.open();
    }


    $scope.cancelConfirmation = function() {
        var locations = _.without($scope.locations, $scope.activeMarker);
        $scope.locations = locations;
        $scope.activeMarker = false;
    }

    $scope.getNextQuestion = function() {
        // should return the slug of the next question
        var nextQuestion = $scope.survey.questions[_.indexOf($scope.survey.questions, $scope.question) + 1];


        return nextQuestion ? nextQuestion.slug : null;
    };

    $scope.getNextQuestionPath = function() {
        var nextQuestion = $scope.getNextQuestion(),
            nextUrl;

        if (nextQuestion) {
            nextUrl = ['survey', $scope.survey.slug, nextQuestion, $routeParams.uuidSlug].join('/');
        } else {
            nextUrl = ['survey', $scope.survey.slug, 'complete', $routeParams.uuidSlug].join('/');
        }

        return nextUrl;
    };

    $scope.gotoNextQuestion = function() {
        var nextUrl = $scope.getNextQuestionPath();
        if (nextUrl) {
            $location.path(nextUrl);
        }
    };

    $scope.answerQuestion = function(answer, otherAnswer) {
        var url = ['/respond/answer', $scope.survey.slug, $routeParams.questionSlug, $routeParams.uuidSlug].join('/');
        if ($scope.dialog) {
            $scope.dialog.options.success($scope.question, answer);
        } else {

            // sometimes we'll have an other field with option text box
            if (answer === "other" && otherAnswer) {
                answer = otherAnswer;
            }


            if ($scope.locations && $scope.locations.length) {
                answer = angular.toJson(_.map($scope.locations,

                function(location) {
                    var returnValue = {
                        lat: location.lat,
                        lng: location.lng,
                        answers: location.answers
                    }

                    if (location.pennies) {
                        returnValue.pennies = parseInt(location.pennies, 10);
                    }
                    return returnValue;
                }));
            }
            $http({
                url: url,
                method: 'POST',
                data: {
                    "answer": answer
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }).success(function(data) {

                if ($scope.dialog) {
                    // we are in a dialog and need to handle it
                    $scope.dialog.close();
                    $scope.addLocation();
                } else {

                    answers[$routeParams.questionSlug] = answer;
                    $scope.gotoNextQuestion();
                }

            });
        }
    };

    /**
     * Filters out unselected items and submits an array of the text portion of the
     * selected options.
     * @param  {array} options An array of all options regardless of which options the
     * user selected.
     */
    $scope.answerMultiSelect = function (options, otherAnswer) {
        var answers = _.filter(options, function(option) {
            return option.checked;
        });
        if (otherAnswer) {
            answers.push({
                text: otherAnswer,
                label: otherAnswer,
                checked: true,
                other: true
            });
        }
        $scope.answerQuestion(answers);
    };

    $scope.removeLocation = function() {
        alert("not yet implemented");
    };


    /* Specific to single select for now. */
    $scope.isAnswerValid = false;

    $scope.onSingleSelectClicked = function (selectedIndex) {
        console.log(selectedIndex);
        _.each($scope.question.options, function (option, index, list) {

            if (index !== selectedIndex) {
                option.checked = false;
            }
        });
        $scope.isAnswerValid = true;
    };

    $scope.answerSingleSelect = function (options) {
        var answers = _.filter(options, function(option) {
            return option.checked;
        });
        $scope.answerQuestion(answers[0]);
    };

    $scope.answerAutoSingleSelect = function (answer, otherAnswer) {
        var selectedOption;
        if (answer === "other") {
            $scope.answerQuestion({text: otherAnswer, label: answer});
        } else {
            $scope.answerQuestion($scope.question.options[answer]);
        }
    };

});