import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
import main as main_module
from main import app, init_db, migrate_db

STRONG = 'Test@Password1!'
EMAIL = 'test@example.com'


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main_module, 'db_file', str(tmp_path / 'test.db'))
    app.config['TESTING'] = True
    app.config['SECRET_KEY'] = 'test-secret'
    with app.test_client() as c:
        init_db()
        migrate_db()
        yield c


def register(client, email=EMAIL, password=STRONG):
    return client.post('/api/register', json={'email': email, 'password': password, 'confirm': password})


def add_credential(client, master_password=STRONG, site='GitHub', username='gh@example.com', password='Gh!Pass123456'):
    return client.post('/api/credentials', json={
        'site': site, 'username': username,
        'password': password, 'master_password': master_password,
        'url': 'github.com', 'category': 'Dev',
    })


# --- auth ---

def test_health(client):
    res = client.get('/api/health')
    assert res.status_code == 200
    assert res.json['ok'] is True


def test_register(client):
    res = register(client)
    assert res.status_code == 201
    assert res.json['ok'] is True


def test_register_duplicate(client):
    register(client)
    res = register(client)
    assert res.status_code == 409


def test_register_weak_password(client):
    res = client.post('/api/register', json={'email': EMAIL, 'password': 'weak', 'confirm': 'weak'})
    assert res.status_code == 400


def test_register_password_mismatch(client):
    res = client.post('/api/register', json={'email': EMAIL, 'password': STRONG, 'confirm': 'Different1!'})
    assert res.status_code == 400


def test_login(client):
    register(client)
    res = client.post('/api/login', json={'email': EMAIL, 'password': STRONG})
    assert res.status_code == 200
    assert res.json['ok'] is True


def test_login_wrong_password(client):
    register(client)
    res = client.post('/api/login', json={'email': EMAIL, 'password': 'Wrong@Pass123!'})
    assert res.status_code == 401


def test_credentials_require_auth(client):
    res = client.get('/api/credentials')
    assert res.status_code == 401


# --- credentials CRUD ---

def test_add_and_list(client):
    register(client)
    res = add_credential(client)
    assert res.status_code == 201

    lst = client.get('/api/credentials')
    assert lst.status_code == 200
    assert len(lst.json['items']) == 1
    assert lst.json['items'][0]['service'] == 'GitHub'
    assert lst.json['items'][0]['category'] == 'Dev'
    assert lst.json['items'][0]['url'] == 'github.com'


def test_reveal(client):
    register(client)
    cid = add_credential(client).json['id']

    res = client.post(f'/api/credentials/{cid}/reveal', json={'master_password': STRONG})
    assert res.status_code == 200
    assert res.json['password'] == 'Gh!Pass123456'


def test_reveal_wrong_master_password(client):
    register(client)
    cid = add_credential(client).json['id']

    res = client.post(f'/api/credentials/{cid}/reveal', json={'master_password': 'Wrong@Pass123!'})
    assert res.status_code == 401


def test_update_metadata(client):
    register(client)
    cid = add_credential(client).json['id']

    res = client.put(f'/api/credentials/{cid}', json={
        'site': 'GitLab', 'username': 'gl@example.com',
        'url': 'gitlab.com', 'category': 'Work',
        'master_password': STRONG,
    })
    assert res.status_code == 200

    item = client.get('/api/credentials').json['items'][0]
    assert item['service'] == 'GitLab'
    assert item['category'] == 'Work'


def test_update_password(client):
    register(client)
    cid = add_credential(client).json['id']

    client.put(f'/api/credentials/{cid}', json={
        'site': 'GitHub', 'username': 'gh@example.com',
        'password': 'NewPass@9876!', 'master_password': STRONG,
    })

    res = client.post(f'/api/credentials/{cid}/reveal', json={'master_password': STRONG})
    assert res.json['password'] == 'NewPass@9876!'


def test_delete(client):
    register(client)
    cid = add_credential(client).json['id']

    res = client.delete(f'/api/credentials/{cid}')
    assert res.status_code == 200
    assert len(client.get('/api/credentials').json['items']) == 0


def test_delete_not_found(client):
    register(client)
    res = client.delete('/api/credentials/9999')
    assert res.status_code == 404


def test_cannot_access_other_users_credential(client):
    register(client, email='alice@example.com')
    cid = add_credential(client).json['id']

    client.post('/api/logout')

    register(client, email='bob@example.com')
    res = client.post(f'/api/credentials/{cid}/reveal', json={'master_password': STRONG})
    assert res.status_code in (401, 404)
