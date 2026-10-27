import pytest


@pytest.fixture(autouse=True)
def no_paid_api(monkeypatch):
    # dotenv override=False preserves these empty values for every normal test.
    monkeypatch.setenv('DEEPSEEK_API_KEY', '')
    monkeypatch.setenv('QWEN_API_KEY', '')
