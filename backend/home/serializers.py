from rest_framework import serializers
from .models import UniversityEvent, EventReview, TweetReview


class UniversityEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = UniversityEvent
        fields = '__all__'
        read_only_fields = ['created_at']


class EventReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventReview
        fields = '__all__'
        read_only_fields = ['created_at', 'tweet_id']


class TweetReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = TweetReview
        fields = '__all__'
        read_only_fields = ['created_at']
