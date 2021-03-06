from django.conf.urls.defaults import *
from survey.views import *


urlpatterns = patterns('',
    (r'delete/(?P<uuid>[\w\d-]+)', delete_responses),
    (r'/answer/(?P<survey_slug>[\w\d-]+)/(?P<question_slug>[\w\d-]+)/(?P<uuid>[\w\d-]+)', answer),
    (r'/submitPage/(?P<survey_slug>[\w\d-]+)/(?P<uuid>[\w\d-]+)', submit_page),
    (r'/complete/(?P<survey_slug>[\w\d-]+)/(?P<uuid>[\w\d-]+)/(?P<action>[\w\d-]+)/(?P<question_slug>[\w\d-]+)', complete),
    (r'/complete/(?P<survey_slug>[\w\d-]+)/(?P<uuid>[\w\d-]+)', complete),

)
