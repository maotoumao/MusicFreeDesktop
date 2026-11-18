#!/bin/bash
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

if [[ "$*" = *--view* ]]; then
  VIEW_ONLY=1
fi

: ${WORKFLOW:=npm-publish.yml}
: ${JOB:=publish-npm}
: ${BRANCH:=github-workflows}
: ${VERSION:="minor (x.y+1.0, new functionality)"}
WORKFLOW_FILE="$SCRIPT_DIR/../.github/workflows/$WORKFLOW_FILE"

function echo-var {
  echo "$1=${!1}"
}

function upload-changes {
  git diff --quiet "$WORKFLOW_FILE"
  if [ $? -eq 1 ]; then
    echo "Uploading changes"
    git add "$WORKFLOW_FILE"
    git commit -m "Update $WORKFLOW_FILE"
    # git push origin "$BRANCH"
    git push origin "$BRANCH" -f
  fi
}

function run-workflow {
  LAST_RUN_ID=$(gh run list --workflow="$WORKFLOW" --json number,databaseId --jq 'sort_by(.number) | .[-1] | .databaseId')
  if [ -n "$WORKFLOW_ARGS" ]; then
    WORKFLOW_ARGS=($WORKFLOW_ARGS)
  else
    if [ "$WORKFLOW" = "npm-publish.yml" ]; then
      WORKFLOW_ARGS=(-f "version=$VERSION")
    fi
  fi
  gh workflow run "$WORKFLOW" --ref "$BRANCH" "${WORKFLOW_ARGS[@]}"
  RUN_ID="$LAST_RUN_ID"
}

function view-workflow {
  while [ "$RUN_ID" = "$LAST_RUN_ID" ]; do
    MOST_RECENT_RUN=$(gh run list --workflow="$WORKFLOW" --json number,databaseId,status --jq  'sort_by(.number) | .[-1] | "\(.databaseId);\(.status)"')
    RUN_ID=${MOST_RECENT_RUN%;*}
    RUN_STATUS=${MOST_RECENT_RUN#*;}
  done

  if [ "$RUN_STATUS" != "completed" ]; then
    gh run watch $RUN_ID
  fi
  gh run view $RUN_ID --log | grep "$JOB" | grep -v '@v'
  if [ $? -ne 0 ]; then
    # xargs is only used for trimming
    ANNOTATION=$(curl "https://github.com/aadsm/jschardet/actions/runs/$RUN_ID" 2>/dev/null | grep 'annotation-message.annotationContainer' -A 1 | tail -n 1 | xargs)
    ANNOTATION=${ANNOTATION##<div>}
    ANNOTATION=${ANNOTATION%%</div>}
    echo "Annotation: $ANNOTATION"
  fi
}

if [ -z $VIEW_ONLY ]; then
  upload-changes
  run-workflow
fi
view-workflow
