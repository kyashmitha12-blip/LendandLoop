from collections import defaultdict


def generate_synthetic_history():
    history = {
        "projector": [8, 10, 12, 9, 11, 14, 12],
        "dslr": [6, 7, 8, 9, 7, 8, 10],
        "arduino": [10, 13, 15, 12, 16, 18, 15],
        "microphone": [5, 6, 9, 8, 7, 10, 9],
        "tripod": [4, 5, 7, 6, 8, 7, 8],
    }
    return history


def predict_demand(category):
    history = generate_synthetic_history().get(category, [5, 6, 7, 8])
    if not history:
        return 5
    average = sum(history) / len(history)
    trend = history[-1] - history[0]
    return max(1, round(average + trend / 3))
