// Copyright (C) 2018 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {assertExists} from '../base/logging';
import {TraceConfig} from '../common/protos';
import {createEmptyRecordConfig} from '../common/state';

import {genConfigProto, toPbtxt} from './record_controller';

test('encodeConfig', () => {
  const config = createEmptyRecordConfig();
  config.durationMs = 20000;
  const result =
      TraceConfig.decode(genConfigProto(config, {os: 'Q', name: 'Android Q'}));
  expect(result.durationMs).toBe(20000);
});

test('SysConfig', () => {
  const config = createEmptyRecordConfig();
  config.cpuSyscall = true;
  const result =
      TraceConfig.decode(genConfigProto(config, {os: 'Q', name: 'Android Q'}));
  const sources = assertExists(result.dataSources);
  const srcConfig = assertExists(sources[0].config);
  const ftraceConfig = assertExists(srcConfig.ftraceConfig);
  const ftraceEvents = assertExists(ftraceConfig.ftraceEvents);
  expect(ftraceEvents.includes('raw_syscalls/sys_enter')).toBe(true);
  expect(ftraceEvents.includes('raw_syscalls/sys_exit')).toBe(true);
});

test('cpu scheduling includes kSyms', () => {
  const config = createEmptyRecordConfig();
  config.cpuSched = true;
  const result =
      TraceConfig.decode(genConfigProto(config, {os: 'Q', name: 'Android Q'}));
  const sources = assertExists(result.dataSources);
  const srcConfig = assertExists(sources[1].config);
  const ftraceConfig = assertExists(srcConfig.ftraceConfig);
  const ftraceEvents = assertExists(ftraceConfig.ftraceEvents);
  expect(ftraceConfig.symbolizeKsyms).toBe(true);
  expect(ftraceEvents.includes('sched/sched_blocked_reason')).toBe(true);
});

test('kSyms can be enabled individually', () => {
  const config = createEmptyRecordConfig();
  config.ftrace = true;
  config.symbolizeKsyms = true;
  const result =
      TraceConfig.decode(genConfigProto(config, {os: 'Q', name: 'Android Q'}));
  const sources = assertExists(result.dataSources);
  const srcConfig = assertExists(sources[0].config);
  const ftraceConfig = assertExists(srcConfig.ftraceConfig);
  const ftraceEvents = assertExists(ftraceConfig.ftraceEvents);
  expect(ftraceConfig.symbolizeKsyms).toBe(true);
  expect(ftraceEvents.includes('sched/sched_blocked_reason')).toBe(true);
});

test('kSyms can be disabled individually', () => {
  const config = createEmptyRecordConfig();
  config.ftrace = true;
  config.symbolizeKsyms = false;
  const result =
      TraceConfig.decode(genConfigProto(config, {os: 'Q', name: 'Android Q'}));
  const sources = assertExists(result.dataSources);
  const srcConfig = assertExists(sources[0].config);
  const ftraceConfig = assertExists(srcConfig.ftraceConfig);
  const ftraceEvents = assertExists(ftraceConfig.ftraceEvents);
  expect(ftraceConfig.symbolizeKsyms).toBe(false);
  expect(ftraceEvents.includes('sched/sched_blocked_reason')).toBe(false);
});

test('toPbtxt', () => {
  const config = {
    durationMs: 1000,
    maxFileSizeBytes: 43,
    buffers: [
      {
        sizeKb: 42,
      },
    ],
    dataSources: [{
      config: {
        name: 'linux.ftrace',
        targetBuffer: 1,
        ftraceConfig: {
          ftraceEvents: ['sched_switch', 'print'],
        },
      },
    }],
    producers: [
      {
        producerName: 'perfetto.traced_probes',
      },
    ],
  };

  const text = toPbtxt(TraceConfig.encode(config).finish());

  expect(text).toEqual(`buffers: {
    size_kb: 42
}
data_sources: {
    config {
        name: "linux.ftrace"
        target_buffer: 1
        ftrace_config {
            ftrace_events: "sched_switch"
            ftrace_events: "print"
        }
    }
}
duration_ms: 1000
producers: {
    producer_name: "perfetto.traced_probes"
}
max_file_size_bytes: 43
`);
});

test('ChromeConfig', () => {
  const config = createEmptyRecordConfig();
  config.ipcFlows = true;
  config.jsExecution = true;
  config.mode = 'STOP_WHEN_FULL';
  const result =
      TraceConfig.decode(genConfigProto(config, {os: 'C', name: 'Chrome'}));
  const sources = assertExists(result.dataSources);

  const traceConfigSource = assertExists(sources[0].config);
  expect(traceConfigSource.name).toBe('org.chromium.trace_event');
  const chromeConfig = assertExists(traceConfigSource.chromeConfig);
  const traceConfig = assertExists(chromeConfig.traceConfig);

  const metadataConfigSource = assertExists(sources[1].config);
  expect(metadataConfigSource.name).toBe('org.chromium.trace_metadata');
  const chromeConfigM = assertExists(metadataConfigSource.chromeConfig);
  const traceConfigM = assertExists(chromeConfigM.traceConfig);

  const expectedTraceConfig = '{"record_mode":"record-until-full",' +
      '"included_categories":' +
      '["toplevel","disabled-by-default-ipc.flow","mojom","v8"],' +
      '"memory_dump_config":{}}';
  expect(traceConfigM).toEqual(expectedTraceConfig);
  expect(traceConfig).toEqual(expectedTraceConfig);
});

test('ChromeMemoryConfig', () => {
  const config = createEmptyRecordConfig();
  config.chromeHighOverheadCategoriesSelected =
      ['disabled-by-default-memory-infra'];
  const result =
      TraceConfig.decode(genConfigProto(config, {os: 'C', name: 'Chrome'}));
  const sources = assertExists(result.dataSources);

  const traceConfigSource = assertExists(sources[0].config);
  expect(traceConfigSource.name).toBe('org.chromium.trace_event');
  const chromeConfig = assertExists(traceConfigSource.chromeConfig);
  const traceConfig = assertExists(chromeConfig.traceConfig);

  const metadataConfigSource = assertExists(sources[1].config);
  expect(metadataConfigSource.name).toBe('org.chromium.trace_metadata');
  const chromeConfigM = assertExists(metadataConfigSource.chromeConfig);
  const traceConfigM = assertExists(chromeConfigM.traceConfig);

  const miConfigSource = assertExists(sources[2].config);
  expect(miConfigSource.name).toBe('org.chromium.memory_instrumentation');
  const chromeConfigI = assertExists(miConfigSource.chromeConfig);
  const traceConfigI = assertExists(chromeConfigI.traceConfig);

  const hpConfigSource = assertExists(sources[3].config);
  expect(hpConfigSource.name).toBe('org.chromium.native_heap_profiler');
  const chromeConfigH = assertExists(hpConfigSource.chromeConfig);
  const traceConfigH = assertExists(chromeConfigH.traceConfig);

  const expectedTraceConfig = '{\"record_mode\":\"record-until-full\",' +
      '\"included_categories\":[\"disabled-by-default-memory-infra\"],' +
      '\"memory_dump_config\":{\"allowed_dump_modes\":[\"background\",' +
      '\"light\",\"detailed\"],\"triggers\":[{\"min_time_between_dumps_ms\":' +
      '10000,\"mode\":\"detailed\",\"type\":\"periodic_interval\"}]}}';
  expect(traceConfigM).toEqual(expectedTraceConfig);
  expect(traceConfig).toEqual(expectedTraceConfig);
  expect(traceConfigI).toEqual(expectedTraceConfig);
  expect(traceConfigH).toEqual(expectedTraceConfig);
});

test('ChromeConfigRingBuffer', () => {
  const config = createEmptyRecordConfig();
  config.ipcFlows = true;
  config.jsExecution = true;
  config.mode = 'RING_BUFFER';
  const result =
      TraceConfig.decode(genConfigProto(config, {os: 'C', name: 'Chrome'}));
  const sources = assertExists(result.dataSources);

  const traceConfigSource = assertExists(sources[0].config);
  expect(traceConfigSource.name).toBe('org.chromium.trace_event');
  const chromeConfig = assertExists(traceConfigSource.chromeConfig);
  const traceConfig = assertExists(chromeConfig.traceConfig);

  const metadataConfigSource = assertExists(sources[1].config);
  expect(metadataConfigSource.name).toBe('org.chromium.trace_metadata');
  const chromeConfigM = assertExists(metadataConfigSource.chromeConfig);
  const traceConfigM = assertExists(chromeConfigM.traceConfig);

  const expectedTraceConfig = '{"record_mode":"record-continuously",' +
      '"included_categories":' +
      '["toplevel","disabled-by-default-ipc.flow","mojom","v8"],' +
      '"memory_dump_config":{}}';
  expect(traceConfigM).toEqual(expectedTraceConfig);
  expect(traceConfig).toEqual(expectedTraceConfig);
});

test('ChromeConfigLongTrace', () => {
  const config = createEmptyRecordConfig();
  config.ipcFlows = true;
  config.jsExecution = true;
  config.mode = 'RING_BUFFER';
  const result =
      TraceConfig.decode(genConfigProto(config, {os: 'C', name: 'Chrome'}));
  const sources = assertExists(result.dataSources);

  const traceConfigSource = assertExists(sources[0].config);
  expect(traceConfigSource.name).toBe('org.chromium.trace_event');
  const chromeConfig = assertExists(traceConfigSource.chromeConfig);
  const traceConfig = assertExists(chromeConfig.traceConfig);

  const metadataConfigSource = assertExists(sources[1].config);
  expect(metadataConfigSource.name).toBe('org.chromium.trace_metadata');
  const chromeConfigM = assertExists(metadataConfigSource.chromeConfig);
  const traceConfigM = assertExists(chromeConfigM.traceConfig);

  const expectedTraceConfig = '{"record_mode":"record-continuously",' +
      '"included_categories":' +
      '["toplevel","disabled-by-default-ipc.flow","mojom","v8"],' +
      '"memory_dump_config":{}}';
  expect(traceConfigM).toEqual(expectedTraceConfig);
  expect(traceConfig).toEqual(expectedTraceConfig);
});

test('ChromeConfigToPbtxt', () => {
  const config = {
    dataSources: [{
      config: {
        name: 'org.chromium.trace_event',
        chromeConfig:
            {traceConfig: JSON.stringify({included_categories: ['v8']})},
      },
    }],
  };
  const text = toPbtxt(TraceConfig.encode(config).finish());

  expect(text).toEqual(`data_sources: {
    config {
        name: "org.chromium.trace_event"
        chrome_config {
            trace_config: "{\\"included_categories\\":[\\"v8\\"]}"
        }
    }
}
`);
});
