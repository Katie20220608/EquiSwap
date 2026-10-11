import pytest

from app.auth import load_secret_key

STRONG = "x" * 40


def test_strong_secret_is_used(monkeypatch):
    monkeypatch.setenv("JWT_SECRET_KEY", STRONG)
    assert load_secret_key() == STRONG


@pytest.mark.parametrize("value", ["", "change-this-secret-in-production", "short"])
def test_weak_secret_rejected_in_production(monkeypatch, value):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("JWT_SECRET_KEY", value)
    with pytest.raises(RuntimeError):
        load_secret_key()


def test_render_counts_as_production(monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)
    with pytest.raises(RuntimeError):
        load_secret_key()


def test_weak_secret_gets_random_value_in_dev(monkeypatch):
    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.setenv("JWT_SECRET_KEY", "short")
    first, second = load_secret_key(), load_secret_key()
    assert first != "short" and len(first) >= 32 and first != second
