from datetime import datetime, timedelta

from backend.models import Resource

# Thresholds (configurable)
IDLE_UTILIZATION_THRESHOLD = 35   # below this % utilization is considered idle
IDLE_DAYS_THRESHOLD = 7           # not used in N days counts as idle


def find_idle_resources(utilization_threshold: int = IDLE_UTILIZATION_THRESHOLD) -> list:
    """
    Return resources that are idle or genuinely under-utilized.
    A resource is idle if:
      - Its status is explicitly 'idle', OR
      - Its utilization is below the threshold AND it is NOT currently booked out.
    """
    all_resources = Resource.query.order_by(Resource.created_at.desc()).all()
    idle = []
    for resource in all_resources:
        if resource.status == "idle":
            idle.append(resource)
        elif resource.utilization is not None and resource.utilization < utilization_threshold and resource.status not in ("booked",):
            # Only flag as idle if it has been created for more than 1 day
            # (avoids flagging brand-new listings with 0 utilization)
            age_days = (datetime.utcnow() - resource.created_at).total_seconds() / 86400 if resource.created_at else 0
            if age_days > 1:
                idle.append(resource)
    return idle
