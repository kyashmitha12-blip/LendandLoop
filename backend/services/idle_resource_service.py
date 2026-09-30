from backend.models import Resource


def find_idle_resources():
    all_resources = Resource.query.order_by(Resource.created_at.desc()).all()
    idle = []
    for resource in all_resources:
        if resource.status == "idle" or resource.utilization < 35:
            idle.append(resource)
    return idle
