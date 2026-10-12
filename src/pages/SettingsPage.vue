<script setup lang="ts">
import { useTemplateRef } from "vue";
import AppSettings from "../components/AppSettings.vue";
import ModelSettings from "../components/ModelSettings.vue";
import VaultSettings from "../components/VaultSettings.vue";
import { desktopModels } from "../adapters/models.ts";
import { packKey, runKey, useProvided } from "../composables/context.ts";

const { status, busy, error, run } = useProvided(packKey);
const { processing } = useProvided(runKey);
const heading = useTemplateRef<HTMLHeadingElement>("heading");
defineExpose({
  focusHeading() {
    heading.value?.focus({ preventScroll: true });
  },
});
</script>

<template>
  <div class="editor-heading"><h1 ref="heading" tabindex="-1">Cài đặt</h1></div>
  <ModelSettings
    :status="status"
    :desktop="desktopModels"
    :busy="busy"
    :error="error"
    :processing="processing"
    @download="run('download')"
    @pause="run('pause')"
    @uninstall="run('uninstall')"
  />
  <VaultSettings />
  <AppSettings />
</template>
