from datetime import datetime, timedelta, timezone

from database import SessionLocal
from models import Operation


def shift_all_operations_to_today(buffer_minutes: int = 10) -> int:
    db = SessionLocal()
    try:
        operations = db.query(Operation).all()
        if not operations:
            return 0

        min_start = min(op.start for op in operations if op.start is not None)
        if min_start is None:
            return 0

        if min_start.tzinfo is None:
            min_start = min_start.replace(tzinfo=timezone.utc)
        else:
            min_start = min_start.astimezone(timezone.utc)

        now_utc = datetime.now(timezone.utc)
        target = now_utc + timedelta(minutes=buffer_minutes)

        if min_start >= target:
            return 0

        offset = target - min_start

        updated = 0
        for op in operations:
            if op.start and op.end:
                if op.start.tzinfo is None:
                    op.start = op.start.replace(tzinfo=timezone.utc)
                else:
                    op.start = op.start.astimezone(timezone.utc)
                if op.end.tzinfo is None:
                    op.end = op.end.replace(tzinfo=timezone.utc)
                else:
                    op.end = op.end.astimezone(timezone.utc)
                op.start = op.start + offset
                op.end = op.end + offset
                updated += 1

        db.commit()
        return updated
    finally:
        db.close()


if __name__ == "__main__":
    count = shift_all_operations_to_today(buffer_minutes=10)
    print(f"Shifted operations to today: {count}")


