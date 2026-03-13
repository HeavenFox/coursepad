import io
import json
import os

import boto3


def _get_client():
    return boto3.client(
        's3',
        endpoint_url=os.environ['R2_ENDPOINT_URL'],
        aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
        region_name='auto',
    )


_client = None
_bucket = None


def _init():
    global _client, _bucket
    if _client is None:
        _client = _get_client()
        _bucket = os.environ['R2_BUCKET']


def _key(prefix, path):
    return prefix + '/' + path


def _cache_control(path):
    if path.startswith('data_index/'):
        return 'public, max-age=3600'
    if path.startswith('data/'):
        return 'public, max-age=31536000, immutable'
    return None


def read_text(prefix, path):
    _init()
    key = _key(prefix, path)
    resp = _client.get_object(Bucket=_bucket, Key=key)
    return resp['Body'].read().decode('utf-8')


def read_json(prefix, path):
    return json.loads(read_text(prefix, path))


def write_text(prefix, path, content):
    _init()
    key = _key(prefix, path)
    kwargs = {}
    cc = _cache_control(path)
    if cc:
        kwargs['CacheControl'] = cc
    _client.put_object(Bucket=_bucket, Key=key, Body=content.encode('utf-8'), **kwargs)


def write_json(prefix, path, obj):
    write_text(prefix, path, json.dumps(obj))


def copy_object(src_prefix, src_path, dst_prefix, dst_path):
    _init()
    src_key = _key(src_prefix, src_path)
    dst_key = _key(dst_prefix, dst_path)
    _client.copy_object(
        Bucket=_bucket,
        CopySource={'Bucket': _bucket, 'Key': src_key},
        Key=dst_key,
    )
