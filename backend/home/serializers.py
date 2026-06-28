from rest_framework import serializers
from .models import UniversityEvent


class UniversityEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = UniversityEvent
        fields = '__all__'
        read_only_fields = ['created_at']
